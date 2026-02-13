import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";

const ALL_CODES: MushafCode[] = ["v1", "v2", "t4", "ut", "i5", "i6", "qh", "tj"];

// Max concurrent downloads across *everything* (all codes + pages)
const GLOBAL_CONCURRENCY = 20;

// Per-request timeout
const TIMEOUT_MS = 15_000;

// ---- Stats ----
type ErrorBucket = "404 (Not Found)" | "500 (Server Error)" | "Network/Timeout" | "Other";

type CodeStats = {
  success: number;
  skipped: number;
  errors: Record<ErrorBucket, number>;
};

function makeStats(): CodeStats {
  return {
    success: 0,
    skipped: 0,
    errors: {
      "404 (Not Found)": 0,
      "500 (Server Error)": 0,
      "Network/Timeout": 0,
      "Other": 0,
    },
  };
}

// ---- Concurrency limiter ----
function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    queue.shift()?.();
  };

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

const limit = pLimit(GLOBAL_CONCURRENCY);

// ---- Main ----
async function main() {
  const codes = parseCodesArg(getArg("--codes"), getArg("--code"));
  const range = hasFlag("--all")
    ? { start: 1, end: TOTAL_PAGES }
    : parsePageRange(getArg("--pages") || "1-1");

  const baseRoot = `https://static.qurancdn.com/fonts/quran/hafs`;

  // Prepare output dirs + stats
  const outRoot = path.join(process.cwd(), "public/mushaf-fonts");
  await mkdir(outRoot, { recursive: true });

  const statsByCode = new Map<MushafCode, CodeStats>();
  for (const c of codes) statsByCode.set(c, makeStats());

  const totalJobs = codes.length * (range.end - range.start + 1);
  let doneJobs = 0;

  console.log(
    `🚀 Syncing mushaf fonts: ${codes.join(", ")} | Pages ${range.start}-${range.end} | Jobs: ${totalJobs} | Concurrency: ${GLOBAL_CONCURRENCY}`
  );

  // Build all jobs, then run under global limiter
  const jobs: Array<Promise<void>> = [];
  for (const code of codes) {
    const outDir = path.join(outRoot, code);
    await mkdir(outDir, { recursive: true });

    const baseUrl = `${baseRoot}/${code}/woff2`;

    for (let page = range.start; page <= range.end; page++) {
      jobs.push(
        limit(async () => {
          await download(baseUrl, outDir, page, statsByCode.get(code)!);
        }).finally(() => {
          doneJobs++;
          if (doneJobs % 25 === 0 || doneJobs === totalJobs) {
            process.stdout.write(`\rProgress: ${doneJobs} / ${totalJobs}`);
          }
        })
      );
    }
  }

  await Promise.all(jobs);
  process.stdout.write("\n");

  printAllSummaries(statsByCode);
}

// ---- Download ----
async function download(base: string, out: string, page: number, stats: CodeStats) {
  const url = `${base}/p${page}.woff2`;
  const dest = path.join(out, `p${String(page).padStart(3, "0")}.woff2`);

  // Skip if already present (Bun.file().exists() is cheap)
  try {
    if (await Bun.file(dest).exists()) {
      stats.skipped++;
      return;
    }
  } catch {
    // ignore, we'll just try to write
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (res.ok) {
      await Bun.write(dest, res);
      stats.success++;
    } else {
      if (res.status === 404) stats.errors["404 (Not Found)"]++;
      else if (res.status >= 500) stats.errors["500 (Server Error)"]++;
      else stats.errors["Other"]++;
    }
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.code === "ECONNRESET") {
      stats.errors["Network/Timeout"]++;
    } else {
      stats.errors["Other"]++;
    }
  }
}

// ---- Summaries ----
function printAllSummaries(statsByCode: Map<MushafCode, CodeStats>) {
  console.log("\n--- 📊 Download Summary (by code) ---");

  const table: Record<string, any> = {};
  for (const [code, s] of statsByCode.entries()) {
    const errorTotal = Object.values(s.errors).reduce((a, b) => a + b, 0);
    table[code] = {
      success: s.success,
      skipped: s.skipped,
      errors: errorTotal,
      "404": s.errors["404 (Not Found)"],
      "500": s.errors["500 (Server Error)"],
      "net/timeout": s.errors["Network/Timeout"],
      other: s.errors["Other"],
    };
  }

  console.table(table);

  for (const [code, s] of statsByCode.entries()) {
    if (s.errors["404 (Not Found)"] > 0 && s.success === 0) {
      console.log(
        `💡 Tip: "${code}" looks unhosted on this CDN path (all 404). Confirm the correct base URL for that variant.`
      );
    }
  }
}

// ---- Args / Helpers ----
function parseCodesArg(codesArg: string | null, codeArg: string | null): MushafCode[] {
  const raw = codesArg ?? codeArg;
  if (!raw) usageAndExit("Missing --codes or --code");

  if (raw === "all") return ALL_CODES;

  // allow: --codes v1,v2,t4  OR --codes v1 v2 t4 (via repeated? not supported by this parser)
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);

  const invalid = parts.filter((p) => !ALL_CODES.includes(p as MushafCode));
  if (invalid.length) {
    usageAndExit(`Invalid code(s): ${invalid.join(", ")}. Valid: ${ALL_CODES.join(", ")} or "all".`);
  }

  return parts as MushafCode[];
}

function getArg(name: string) {
  return process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
}
function hasFlag(name: string) {
  return process.argv.includes(name);
}
function parsePageRange(input: string) {
  const [s, e] = input.split("-").map(Number);
  return { start: s || 1, end: e || s || 1 };
}
function usageAndExit(msg: string): never {
  console.error(`❌ ${msg}
Usage:
  bun script.ts --codes all --all
  bun script.ts --codes v1,v2,t4 --pages 1-50
  bun script.ts --code v1 --all   (still works)
`);
  process.exit(1);
}

main();
