import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";

// Configuration
const ALL_CODES: MushafCode[] = ["v1", "v2", "t4", "ut", "i5", "i6", "qh", "tj"];
const GLOBAL_CONCURRENCY = 20;
const TIMEOUT_MS = 15_000;

// CDN Base URLs
const FONT_BASE = "https://static.qurancdn.com/fonts/quran/hafs";
const DATA_BASE = "https://quran.fullstacktics.com/mushaf-data"; 
const FALLBACK_DATA_BASE = "https://quran.com/mushaf-data"; 

// ---- Stats Tracker ----
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

// ---- Concurrency Limiter ----
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

// ---- Main Execution ----
async function main() {
  const codes = parseCodesArg(getArg("--codes"), getArg("--code"));
  const range = hasFlag("--all")
    ? { start: 1, end: TOTAL_PAGES }
    : parsePageRange(getArg("--pages") || "1-1");

  const publicRoot = path.join(process.cwd(), "public");
  const statsByCode = new Map<MushafCode, CodeStats>();
  for (const c of codes) statsByCode.set(c, makeStats());

  const totalTasks = codes.length * (range.end - range.start + 1) * 3; // Font + JSON + PB
  let doneTasks = 0;

  console.log(`🚀 Syncing Assets: ${codes.join(", ")} | Pages ${range.start}-${range.end}`);

  const jobs: Array<Promise<void>> = [];

  for (const code of codes) {
    const fontDir = path.join(publicRoot, "mushaf-fonts", code);
    const dataDir = path.join(publicRoot, "mushaf-data", code);
    
    await mkdir(fontDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });

    for (let page = range.start; page <= range.end; page++) {
      const pageStats = statsByCode.get(code)!;
      const paddedPage = String(page).padStart(3, "0");

      // 1. Font Download (.woff2)
      jobs.push(limit(async () => {
        const dest = path.join(fontDir, `p${paddedPage}.woff2`);
        await tryDownload(
          [
            `${FONT_BASE}/${code}/woff2/p${page}.woff2`,
            `${FONT_BASE}/${code}/woff2/p${paddedPage}.woff2`
          ],
          dest,
          pageStats
        );
      }).finally(() => { doneTasks++; updateProgress(doneTasks, totalTasks); }));

      // 2. JSON Layout Download (.json)
      jobs.push(limit(async () => {
        const dest = path.join(dataDir, `p${paddedPage}.json`);
        await tryDownload(
          [
            `${DATA_BASE}/${code}/p${page}.json`,
            `${DATA_BASE}/${code}/p${paddedPage}.json`,
            `${FALLBACK_DATA_BASE}/${code}/p${page}.json`,
            `${FALLBACK_DATA_BASE}/${code}/p${paddedPage}.json`
          ],
          dest,
          pageStats
        );
      }).finally(() => { doneTasks++; updateProgress(doneTasks, totalTasks); }));

      // 3. Protobuf Download (.pb)
      jobs.push(limit(async () => {
        const dest = path.join(dataDir, `p${paddedPage}.pb`);
        await tryDownload(
          [
            `${DATA_BASE}/${code}/p${page}.pb`,
            `${DATA_BASE}/${code}/p${paddedPage}.pb`,
            `${FALLBACK_DATA_BASE}/${code}/p${page}.pb`,
            `${FALLBACK_DATA_BASE}/${code}/p${paddedPage}.pb`
          ],
          dest,
          pageStats
        );
      }).finally(() => { doneTasks++; updateProgress(doneTasks, totalTasks); }));
    }
  }

  await Promise.all(jobs);
  process.stdout.write("\n");
  printAllSummaries(statsByCode);
}

async function tryDownload(urls: string[], dest: string, stats: CodeStats): Promise<boolean> {
  // Check if already exists first
  try {
    if (await Bun.file(dest).exists()) {
      stats.skipped++;
      return true;
    }
  } catch { }

  for (const url of urls) {
    if (await downloadFile(url, dest)) {
      stats.success++;
      return true;
    }
  }
  stats.errors["Other"]++; 
  return false;
}

async function downloadFile(url: string, dest: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      await Bun.write(dest, res);
      return true;
    }
  } catch { }
  return false;
}

// ---- Utilities ----
function updateProgress(done: number, total: number) {
  if (done % 10 === 0 || done === total) {
    process.stdout.write(`\rProgress: ${done} / ${total}`);
  }
}

function printAllSummaries(statsByCode: Map<MushafCode, CodeStats>) {
  console.log("\n--- 📊 Download Summary ---");
  const table: Record<string, any> = {};
  for (const [code, s] of statsByCode.entries()) {
    table[code] = {
      success: s.success,
      skipped: s.skipped,
      errors: Object.values(s.errors).reduce((a, b) => a + b, 0),
    };
  }
  console.table(table);
}

function parseCodesArg(codesArg: string | null, codeArg: string | null): MushafCode[] {
  const raw = codesArg ?? codeArg;
  if (!raw) return ALL_CODES;
  if (raw === "all") return ALL_CODES;
  return raw.split(",").map((s) => s.trim()) as MushafCode[];
}

function getArg(name: string) { return process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null; }
function hasFlag(name: string) { return process.argv.includes(name); }
function parsePageRange(input: string) {
  const [s, e] = input.split("-").map(Number);
  return { start: s || 1, end: e || s || 1 };
}

main();
