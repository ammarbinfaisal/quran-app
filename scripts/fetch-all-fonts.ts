import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";

type QcfCode = "v2";

const UNICODE_FONTS = [
  {
    remote: "https://static.qurancdn.com/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2",
    local: "public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2",
  },
  {
    remote: "https://static.qurancdn.com/fonts/quran/surah-names/v1/sura_names.woff2",
    local: "public/fonts/quran/surah-names/v1/sura_names.woff2",
  },
];

function usageAndExit(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    [
      "Usage:",
      "  bun scripts/fetch-all-fonts.ts --all-fonts       (Downloads everything)",
      "  bun scripts/fetch-all-fonts.ts --code v2 --all   (All pages for v2)",
      "  bun scripts/fetch-all-fonts.ts --code v2 --pages 1-50",
      "",
      "Notes:",
      "  - Downloads from https://static.qurancdn.com",
      "  - Saves QCF fonts to public/mushaf-fonts/<code>/pXXX.woff2 (zero-padded)",
      "  - Saves Unicode fonts to public/fonts/quran/...",
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

async function downloadFile(url: string, dest: string) {
  await ensureDir(path.dirname(dest));
  const res = await fetchOk(url);
  const bytes = await res.arrayBuffer();
  await Bun.write(dest, new Uint8Array(bytes));
}

async function main() {
  const allFonts = hasFlag("--all-fonts");
  const codeRaw = getArg("--code");
  const pagesArg = getArg("--pages");
  const allPages = hasFlag("--all");

  if (!allFonts && !codeRaw && !pagesArg) {
    usageAndExit("Nothing to do.");
  }

  if (allFonts) {
    console.log("Fetching all fonts (V2 + Unicode)...");
    await fetchUnicodeFonts();
    await fetchQcfFonts("v2", 1, TOTAL_PAGES);
    return;
  }

  if (codeRaw) {
    if (codeRaw !== "v2") {
      usageAndExit(`Unsupported --code: ${codeRaw}`);
    }
    const code = codeRaw as QcfCode;
    const range = allPages ? { start: 1, end: TOTAL_PAGES } : parsePageRange(pagesArg || "1-1");
    await fetchQcfFonts(code, range.start, range.end);
  }
}

async function fetchUnicodeFonts() {
  console.log("\n--- Unicode Fonts ---");
  for (const font of UNICODE_FONTS) {
    try {
      const dest = path.join(process.cwd(), font.local);
      await downloadFile(font.remote, dest);
      console.log(`OK: ${path.basename(font.local)}`);
    } catch (e) {
      console.error(`FAIL: ${font.remote} -> ${String(e)}`);
    }
  }
}

async function fetchQcfFonts(code: QcfCode, start: number, end: number) {
  const base = "https://static.qurancdn.com/fonts/quran/hafs";
  const outDir = path.join(process.cwd(), "public", "mushaf-fonts", code);
  await ensureDir(outDir);

  console.log(`\n--- QCF ${code} (pages ${start}-${end}) ---`);

  const concurrency = 16;
  let nextPage = start;
  let ok = 0;
  let fail = 0;

  const worker = async () => {
    for (; ;) {
      const pageNum = nextPage;
      nextPage += 1;
      if (pageNum > end) return;

      const remoteUrl = `${base}/${code}/woff2/p${pageNum}.woff2`;
      const fileName = `p${pad3(pageNum)}.woff2`;
      const outPath = path.join(outDir, fileName);

      try {
        const res = await fetchOk(remoteUrl);
        const bytes = await res.arrayBuffer();
        await Bun.write(outPath, new Uint8Array(bytes));
        ok += 1;
        if (ok % 50 === 0) process.stdout.write(".");
      } catch (e) {
        fail += 1;
        console.error(`\nFAIL p${pageNum}: ${String(e)}`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone QCF ${code}: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


