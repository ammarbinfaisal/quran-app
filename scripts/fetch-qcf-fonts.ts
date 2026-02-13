import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";

type QcfCode = "v1" | "v2";

function usageAndExit(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    [
      "Usage:",
      "  bun scripts/fetch-qcf-fonts.ts --code v2 --pages 1-50",
      "  bun scripts/fetch-qcf-fonts.ts --code v2 --all",
      "",
      "Notes:",
      "  - Downloads from https://static.qurancdn.com",
      "  - Saves to public/mushaf-fonts/<code>/pXXX.woff2 (zero-padded)",
    ].join("\n")
  );
  process.exit(1);
}

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  return val && !val.startsWith("--") ? val : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function parsePageRange(input: string): { start: number; end: number } {
  const m = /^(\d+)-(\d+)$/.exec(input);
  if (!m) usageAndExit(`Invalid --pages value: ${input}`);
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    usageAndExit(`Invalid --pages range: ${input}`);
  }
  return { start, end };
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

async function fetchOk(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res;
}

async function main() {
  const codeRaw = getArg("--code");
  if (!codeRaw) usageAndExit("Missing --code (v1 or v2)");
  if (codeRaw !== "v1" && codeRaw !== "v2") usageAndExit(`Unsupported --code: ${codeRaw}`);
  const code = codeRaw as QcfCode;

  const pagesArg = getArg("--pages");
  const all = hasFlag("--all");
  if (!all && !pagesArg) usageAndExit("Provide --pages <start-end> or --all");
  if (all && pagesArg) usageAndExit("Use either --pages or --all (not both)");

  const range = all ? { start: 1, end: TOTAL_PAGES } : parsePageRange(pagesArg!);

  const base = "https://static.qurancdn.com/fonts/quran/hafs";
  const outDir = path.join(process.cwd(), "public", "mushaf-fonts", code);
  await ensureDir(outDir);

  // Sanity check: page 1 exists.
  await fetchOk(`${base}/${code}/woff2/p1.woff2`);

  const concurrency = 8;
  let nextPage = range.start;
  let ok = 0;
  let fail = 0;

  const worker = async () => {
    for (;;) {
      const pageNum = nextPage;
      nextPage += 1;
      if (pageNum > range.end) return;

      const remoteUrl = `${base}/${code}/woff2/p${pageNum}.woff2`;
      const fileName = `p${pad3(pageNum)}.woff2`;
      const outPath = path.join(outDir, fileName);

      try {
        const res = await fetchOk(remoteUrl);
        const bytes = await res.arrayBuffer();
        await Bun.write(outPath, new Uint8Array(bytes));
        ok += 1;
      } catch (e) {
        fail += 1;
        console.error(String(e));
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(
    `Downloaded QCF ${code} fonts: ok=${ok} fail=${fail} -> ${path.relative(process.cwd(), outDir)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

