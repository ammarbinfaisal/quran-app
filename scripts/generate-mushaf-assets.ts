import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";
import { encodeMushafPagePayload, type MushafPagePayload } from "../src/lib/mushaf/proto";
import { QuranClient } from "@quranjs/api";
// Config
const ALL_CODES: MushafCode[] = ["v1", "v2", "t4", "ut", "i5", "i6", "qh", "tj"];
const GLOBAL_CONCURRENCY = 5;
const AVG_CHAR_WIDTH = 20; // Rough estimate for x/width in pixels
// Client (public access for verses)
const client = new QuranClient({ defaults: { language: "ar" } });
type ErrorBucket = "API Fail" | "Encoding Fail" | "Other";
type CodeStats = { success: number; errors: Record<ErrorBucket, number> };
function makeStats(): CodeStats {
  return { success: 0, errors: { "API Fail": 0, "Encoding Fail": 0, "Other": 0 } };
}
async function main() {
  const codes = parseCodesArg(getArg("--codes"), getArg("--code"));
  const range = hasFlag("--all") ? { start: 1, end: TOTAL_PAGES } : parsePageRange(getArg("--pages") || "1-1");
  const publicRoot = path.join(process.cwd(), "public");
  const statsByCode = new Map<MushafCode, CodeStats>();
  for (const c of codes) statsByCode.set(c, makeStats());
  let doneTasks = 0;
  const totalTasks = codes.length * (range.end - range.start + 1) * 2; // JSON + PB per page/code
  console.log(`🚀 Generating Assets: ${codes.join(", ")} | Pages ${range.start}-${range.end}`);
  const jobs: Array<Promise<void>> = [];
  for (const code of codes) {
    const dataDir = path.join(publicRoot, "mushaf-data", code);
    await mkdir(dataDir, { recursive: true });
    for (let page = range.start; page <= range.end; page++) {
      const pageStats = statsByCode.get(code)!;
      const paddedPage = String(page).padStart(3, "0");
      jobs.push((async () => {
        try {
          // Fetch page verses with words (includes line_number, text, verse_key)
          const response = await client.verses.findByPage(page.toString(), { words: true });
          const payload = generatePayload(response.verses, code, page);
          if (!payload.lines.length) throw new Error("No lines generated");
          // Save JSON
          const jsonPath = path.join(dataDir, `p${paddedPage}.json`);
          await Bun.write(jsonPath, JSON.stringify(payload, null, 2));
          pageStats.success++;
          // Encode to PB
          const buffer = encodeMushafPagePayload(payload);
          const pbPath = path.join(dataDir, `p${paddedPage}.pb`);
          await Bun.write(pbPath, buffer);
          pageStats.success++;
        } catch (err: any) {
          console.error(`Failed p${page} for ${code}:`, err.message);
          (pageStats.errors as any)[err.message.includes("API") ? "API Fail" : "Other"]++;
        }
        doneTasks++;
        updateProgress(doneTasks, totalTasks);
      })());
    }
  }
  await Promise.all(jobs);
  process.stdout.write("\n");
  printAllSummaries(statsByCode);
}
function generatePayload(verses: any[], code: MushafCode, page: number): MushafPagePayload {
  const linesMap = new Map<number, { text: string; verseKey: string; x: number; width: number }[]>();
  let maxLine = 0;
  for (const verse of verses) {
    for (const wordData of verse.words.filter((w: any) => w.char_type_name === "word")) {
      const lineNum = wordData.line_number || 1;
      maxLine = Math.max(maxLine, lineNum);
      const existing = linesMap.get(lineNum) || [];
      const x = existing.length * AVG_CHAR_WIDTH; // Sequential x positioning
      const width = (wordData.text?.length || 1) * AVG_CHAR_WIDTH;
      existing.push({
        text: wordData.text || "",
        verseKey: verse.verse_key,
        x,
        width
      });
      linesMap.set(lineNum, existing);
    }
  }
  const lines: any[] = [];
  for (let i = 1; i <= maxLine; i++) {
    const words = linesMap.get(i) || [];
    if (words.length > 0) {
      lines.push({ lineNumber: i, words });
    }
  }
  return { page, mushafCode: code, lines };
}
function updateProgress(done: number, total: number) {
  if (done % 50 === 0 || done === total) {
    process.stdout.write(`\rProgress: ${done}/${total}`);
  }
}
function printAllSummaries(statsByCode: Map<MushafCode, CodeStats>) {
  console.log("\n--- 📊 Generation Summary ---");
  const table: Record<string, any> = {};
  for (const [code, s] of statsByCode) {
    table[code] = { success: s.success, errors: Object.values(s.errors).reduce((a, b) => a + b, 0) };
  }
  console.table(table);
}
function parseCodesArg(codesArg: string | null, codeArg: string | null): MushafCode[] {
  const raw = codesArg ?? codeArg;
  if (!raw) return ALL_CODES;
  if (raw === "all") return ALL_CODES;
  return raw.split(",").map((s) => s.trim()) as MushafCode[];
}
function getArg(name: string) {
  const idx = process.argv.lastIndexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}
function hasFlag(name: string) { return process.argv.includes(name); }
function parsePageRange(input: string) {
  const [s, e] = input.split("-").map(Number);
  return { start: s || 1, end: e || s || 1 };
}
main().catch(console.error);
