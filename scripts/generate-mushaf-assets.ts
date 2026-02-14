import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";
import {
  encodeMushafPagePayload,
  type MushafPagePayload,
} from "../src/lib/mushaf/proto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ALL_CODES: MushafCode[] = [
  "v1",
  "v2",
  "t4",
  "ut",
  "i5",
  "i6",
  "qh",
  "tj",
];
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const AVG_CHAR_WIDTH = 20;
const API_BASE = "https://api.quran.com/api/v4";

// ---------------------------------------------------------------------------
// API client (direct fetch, no SDK — SDK requires OAuth which is unreliable)
// ---------------------------------------------------------------------------
async function fetchVersesByPage(page: number): Promise<any[]> {
  const url = `${API_BASE}/verses/by_page/${page}?language=ar&words=true&per_page=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as any;
  return data.verses ?? [];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
type ErrorBucket = "API Fail" | "Encoding Fail" | "Other";
type CodeStats = {
  success: number;
  skipped: number;
  errors: Record<ErrorBucket, number>;
};
function makeStats(): CodeStats {
  return {
    success: 0,
    skipped: 0,
    errors: { "API Fail": 0, "Encoding Fail": 0, Other: 0 },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const codes = parseCodesArg(getArg("--codes"), getArg("--code"));
  const range = hasFlag("--all")
    ? { start: 1, end: TOTAL_PAGES }
    : parsePageRange(getArg("--pages") || "1-1");
  const force = hasFlag("--force");

  const publicRoot = path.join(process.cwd(), "public");
  const statsByCode = new Map<MushafCode, CodeStats>();
  for (const c of codes) statsByCode.set(c, makeStats());

  const dataDirs = new Map<MushafCode, string>();
  for (const code of codes) {
    const dir = path.join(publicRoot, "mushaf-data", code);
    await mkdir(dir, { recursive: true });
    dataDirs.set(code, dir);
  }

  const totalPages = range.end - range.start + 1;
  let donePages = 0;

  console.log(
    `Generating: codes=[${codes.join(",")}] pages=${range.start}-${range.end} (${totalPages} pages) force=${force}`
  );

  const pageQueue: number[] = [];
  for (let p = range.start; p <= range.end; p++) pageQueue.push(p);

  let queueIdx = 0;
  const worker = async () => {
    while (queueIdx < pageQueue.length) {
      const page = pageQueue[queueIdx++];
      if (page === undefined) break;

      if (!force) {
        const allExist = codes.every((code) => {
          const dir = dataDirs.get(code)!;
          const padded = String(page).padStart(3, "0");
          return (
            existsSync(path.join(dir, `p${padded}.json`)) &&
            existsSync(path.join(dir, `p${padded}.pb`))
          );
        });
        if (allExist) {
          for (const code of codes) statsByCode.get(code)!.skipped++;
          donePages++;
          updateProgress(donePages, totalPages);
          continue;
        }
      }

      let verses: any[] | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          verses = await fetchVersesByPage(page);
          break;
        } catch (err: any) {
          if (attempt === MAX_RETRIES) {
            console.error(
              `\nFailed API p${page} after ${MAX_RETRIES} retries: ${err.message}`
            );
            for (const code of codes)
              statsByCode.get(code)!.errors["API Fail"]++;
          } else {
            await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
          }
        }
      }

      if (!verses) {
        donePages++;
        updateProgress(donePages, totalPages);
        continue;
      }

      for (const code of codes) {
        const dir = dataDirs.get(code)!;
        const stats = statsByCode.get(code)!;
        const padded = String(page).padStart(3, "0");

        if (!force) {
          const jsonExists = existsSync(path.join(dir, `p${padded}.json`));
          const pbExists = existsSync(path.join(dir, `p${padded}.pb`));
          if (jsonExists && pbExists) {
            stats.skipped++;
            continue;
          }
        }

        try {
          const payload = generatePayload(verses, code, page);
          if (!payload.lines.length) throw new Error("No lines generated");

          await Bun.write(
            path.join(dir, `p${padded}.json`),
            JSON.stringify(payload)
          );

          const buffer = encodeMushafPagePayload(payload);
          await Bun.write(path.join(dir, `p${padded}.pb`), buffer);

          stats.success++;
        } catch (err: any) {
          console.error(`\nFailed encoding p${page}/${code}: ${err.message}`);
          stats.errors[
            err.message.includes("Encoding") ? "Encoding Fail" : "Other"
          ]++;
        }
      }

      donePages++;
      updateProgress(donePages, totalPages);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  process.stdout.write("\n");
  printSummary(statsByCode);
}

// ---------------------------------------------------------------------------
// Payload generation
// ---------------------------------------------------------------------------
function generatePayload(
  verses: any[],
  code: MushafCode,
  page: number
): MushafPagePayload {
  const linesMap = new Map<
    number,
    { text: string; verseKey: string; x: number; width: number }[]
  >();
  let maxLine = 0;
  for (const verse of verses) {
    for (const wordData of verse.words.filter(
      (w: any) => w.char_type_name === "word"
    )) {
      const lineNum = wordData.line_number || 1;
      maxLine = Math.max(maxLine, lineNum);
      const existing = linesMap.get(lineNum) || [];
      const x = existing.length * AVG_CHAR_WIDTH;
      const width = (wordData.text?.length || 1) * AVG_CHAR_WIDTH;
      existing.push({
        text: wordData.text || "",
        verseKey: verse.verse_key,
        x,
        width,
      });
      linesMap.set(lineNum, existing);
    }
  }
  const lines: MushafPagePayload["lines"] = [];
  for (let i = 1; i <= maxLine; i++) {
    const words = linesMap.get(i) || [];
    if (words.length > 0) {
      lines.push({ lineNumber: i, words });
    }
  }
  return { page, mushafCode: code, lines };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function updateProgress(done: number, total: number) {
  if (done % 10 === 0 || done === total) {
    const pct = ((done / total) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${done}/${total} (${pct}%)`);
  }
}

function printSummary(statsByCode: Map<MushafCode, CodeStats>) {
  console.log("\n--- Generation Summary ---");
  const table: Record<string, any> = {};
  for (const [code, s] of statsByCode) {
    const errs = Object.values(s.errors).reduce((a, b) => a + b, 0);
    table[code] = { success: s.success, skipped: s.skipped, errors: errs };
  }
  console.table(table);
  const totalErrors = [...statsByCode.values()].reduce(
    (sum, s) => sum + Object.values(s.errors).reduce((a, b) => a + b, 0),
    0
  );
  if (totalErrors > 0) {
    console.error(
      `\n${totalErrors} errors occurred. Re-run without --force to fill gaps.`
    );
    process.exit(1);
  }
}

function parseCodesArg(
  codesArg: string | null,
  codeArg: string | null
): MushafCode[] {
  const raw = codesArg ?? codeArg;
  if (!raw) return ALL_CODES;
  if (raw === "all") return ALL_CODES;
  return raw.split(",").map((s) => s.trim()) as MushafCode[];
}

function getArg(name: string) {
  const idx = process.argv.lastIndexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parsePageRange(input: string) {
  const [s, e] = input.split("-").map(Number);
  return { start: s || 1, end: e || s || 1 };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
