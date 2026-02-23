import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";
import {
  encodeMushafPagePayload,
  type MushafPagePayload,
} from "../src/lib/mushaf/proto";
import type { TranslationId } from "../src/lib/types";
import { TRANSLATION_API_IDS } from "../src/lib/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ALL_CODES: MushafCode[] = ["v2"];
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const AVG_CHAR_WIDTH = 20;
const API_BASE = "https://api.quran.com/api/v4";
const WORD_FIELDS = ["code_v2", "v1_page", "v2_page", "line_v1", "line_v2"].join(",");

// For each mushaf code: which word field holds the rendered text.
const TEXT_FIELD_BY_CODE: Record<MushafCode, keyof VerseWord> = { v2: "code_v2" };

// For each mushaf code: which word field holds the line number within the page.
const LINE_FIELD_BY_CODE: Record<MushafCode, keyof VerseWord> = { v2: "line_v2" };

// For each mushaf code: which word field holds the font-file page number.
// The font-file page is the source of truth for which page a glyph belongs to.
// It may differ from the API layout page (page_number) at verse boundaries —
// the same verse can straddle two pages and the API groups words by layout page,
// while the font file groups by physical rendering page.
const FONT_PAGE_FIELD_BY_CODE: Record<MushafCode, keyof VerseWord> = { v2: "v2_page" };

const MUSHAF_ID_BY_CODE: Record<MushafCode, number> = { v2: 1 };
const PAGES_BY_MUSHAF_ID: Record<number, number> = { 1: TOTAL_PAGES };

type FootnoteTranslationId = Exclude<TranslationId, "abu-iyaad">;
const FOOTNOTE_TRANSLATIONS: FootnoteTranslationId[] = ["saheeh", "hilali-khan"];
const FOOTNOTE_ASSET_FILE = "translation-footnotes.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type VerseWord = {
  char_type_name?: string;
  text?: string;
  code_v2?: string;
  text_uthmani?: string;
  text_qpc_hafs?: string;
  text_indopak?: string;
  line_number?: number;
  line_v2?: number;
  page_number?: number;
  v1_page?: number;
  v2_page?: number;
};

type RawVerse = {
  verse_key: string;
  words?: VerseWord[];
};

// A fully resolved word entry used during payload generation.
// word_index is the 0-based position within the verse (stable API identity).
type ResolvedWord = {
  word_index: number;
  verse_key: string;
  word: VerseWord;
};

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
async function fetchVersesByPage(page: number, mushafId: number): Promise<RawVerse[]> {
  const url =
    `${API_BASE}/verses/by_page/${page}` +
    `?language=ar&words=true&per_page=50&word_fields=${encodeURIComponent(WORD_FIELDS)}&mushaf=${mushafId}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as { verses?: RawVerse[] };
      return data.verses ?? [];
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }
  return []; // unreachable
}

interface TranslationPageResponse {
  translations?: Array<{ verse_key: string; text?: string }>;
  foot_notes?: Record<string, string>;
}

async function fetchTranslationPage(
  resourceId: number,
  page: number,
): Promise<TranslationPageResponse> {
  const url = new URL(`${API_BASE}/quran/translations/${resourceId}`);
  url.searchParams.set("fields", "verse_key,text");
  url.searchParams.set("page_number", String(page));
  url.searchParams.set("foot_notes", "true");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<TranslationPageResponse>;
}

// ---------------------------------------------------------------------------
// Word collection: fetch page N + page N+1, deduplicate by (verse_key, word_index)
//
// Why fetch two pages?
//   The quran.com API groups words by layout page (page_number), but the QCF
//   font file groups by rendering page (v2_page). At page boundaries a verse
//   can span two layout pages — so the last few words of a verse, which render
//   on page N (v2_page=N), may only appear in the API response for page N+1.
//   By fetching both API pages and keeping only words where v2_page === N, we
//   get the complete and accurate set of words that render on font page N.
// ---------------------------------------------------------------------------
async function collectWordsForPage(
  page: number,
  mushafId: number,
  maxPages: number,
): Promise<{ words: ResolvedWord[]; rawVerses: RawVerse[] }> {
  // Fetch the primary page (required).
  const primaryVerses = await fetchVersesByPage(page, mushafId);

  // Fetch the next page (best-effort — needed for spillover words).
  let nextVerses: RawVerse[] = [];
  if (page < maxPages) {
    try {
      nextVerses = await fetchVersesByPage(page + 1, mushafId);
    } catch {
      // Non-fatal: we'll still generate a best-effort asset for page N.
    }
  }

  // Merge the two responses into a single deduplicated word list.
  // Key: `${verse_key}:${word_index}` — stable per the API (word order within
  // a verse never changes between requests).
  const seen = new Map<string, ResolvedWord>();

  function addVerses(verses: RawVerse[]) {
    for (const verse of verses) {
      const words = verse.words ?? [];
      for (let i = 0; i < words.length; i++) {
        const key = `${verse.verse_key}:${i}`;
        if (!seen.has(key)) {
          seen.set(key, { word_index: i, verse_key: verse.verse_key, word: words[i] });
        }
      }
    }
  }

  addVerses(primaryVerses);
  addVerses(nextVerses);

  return {
    words: Array.from(seen.values()),
    rawVerses: primaryVerses,
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
type ErrorBucket = "API Fail" | "Encoding Fail" | "Other";
type CodeStats = { success: number; skipped: number; errors: Record<ErrorBucket, number> };

function makeStats(): CodeStats {
  return { success: 0, skipped: 0, errors: { "API Fail": 0, "Encoding Fail": 0, Other: 0 } };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const codes = parseCodesArg(getArg("--codes"), getArg("--code"));
  const explicitPages = getArg("--pages");
  const force = hasFlag("--force");

  const publicRoot = path.join(process.cwd(), "public");
  const statsByCode = new Map<MushafCode, CodeStats>();
  const footnoteDir = path.join(publicRoot, "mushaf-data");
  await mkdir(footnoteDir, { recursive: true });
  const footnoteAssetPath = path.join(footnoteDir, FOOTNOTE_ASSET_FILE);
  const footnotesByTranslation = await loadExistingFootnotes(footnoteAssetPath);
  for (const c of codes) statsByCode.set(c, makeStats());

  const dataDirs = new Map<MushafCode, string>();
  for (const code of codes) {
    const dir = path.join(publicRoot, "mushaf-data", code);
    await mkdir(dir, { recursive: true });
    dataDirs.set(code, dir);
  }

  type Task = { mushafId: number; page: number; codes: MushafCode[] };
  const tasksQueue: Task[] = [];

  const codesByMushaf = new Map<number, MushafCode[]>();
  for (const code of codes) {
    const mId = MUSHAF_ID_BY_CODE[code];
    const arr = codesByMushaf.get(mId) ?? [];
    arr.push(code);
    codesByMushaf.set(mId, arr);
  }

  for (const [mushafId, mCodes] of codesByMushaf.entries()) {
    const maxPages = PAGES_BY_MUSHAF_ID[mushafId] ?? TOTAL_PAGES;
    const isAll = hasFlag("--all") || !explicitPages;
    const { start, end } = isAll
      ? { start: 1, end: maxPages }
      : parsePageRange(explicitPages ?? "1-1");

    for (let p = start; p <= Math.min(end, maxPages); p++) {
      tasksQueue.push({ mushafId, page: p, codes: mCodes });
    }
  }

  const totalTasks = tasksQueue.length;
  let doneTasks = 0;
  console.log(`Generating: codes=[${codes.join(",")}] (${totalTasks} tasks) force=${force}`);

  let queueIdx = 0;
  const worker = async () => {
    while (queueIdx < tasksQueue.length) {
      const task = tasksQueue[queueIdx++];
      if (!task) break;

      const { mushafId, page, codes: taskCodes } = task;
      const maxPages = PAGES_BY_MUSHAF_ID[mushafId] ?? TOTAL_PAGES;
      const padded = String(page).padStart(3, "0");

      if (!force) {
        const allExist = taskCodes.every((code) => {
          const dir = dataDirs.get(code)!;
          return (
            existsSync(path.join(dir, `p${padded}.json`)) &&
            existsSync(path.join(dir, `p${padded}.pb`))
          );
        });
        if (allExist) {
          for (const code of taskCodes) statsByCode.get(code)!.skipped++;
          doneTasks++;
          updateProgress(doneTasks, totalTasks);
          continue;
        }
      }

      // Collect words for this page (with next-page spillover).
      let collected: { words: ResolvedWord[]; rawVerses: RawVerse[] } | null = null;
      try {
        collected = await collectWordsForPage(page, mushafId, maxPages);
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`\nFailed API m${mushafId}/p${page}: ${err.message}`);
        for (const code of taskCodes) statsByCode.get(code)!.errors["API Fail"]++;
        doneTasks++;
        updateProgress(doneTasks, totalTasks);
        continue;
      }

      // Collect footnotes from the primary page response.
      if (mushafId === 1) {
        await Promise.all(
          FOOTNOTE_TRANSLATIONS.map(async (translationId) => {
            const resourceId = TRANSLATION_API_IDS[translationId];
            if (!resourceId) return;
            try {
              const data = await fetchTranslationPage(resourceId, page);
              const pageFootnotes = data.foot_notes;
              if (pageFootnotes) {
                const target = footnotesByTranslation[translationId];
                for (const [id, text] of Object.entries(pageFootnotes)) {
                  if (!target[id]) target[id] = text;
                }
              }
            } catch (error: unknown) {
              const err = error as Error;
              console.error(`\nFailed to load footnotes p${page}/${translationId}: ${err.message}`);
            }
          }),
        );
      }

      for (const code of taskCodes) {
        const dir = dataDirs.get(code)!;
        const stats = statsByCode.get(code)!;

        if (!force) {
          const jsonExists = existsSync(path.join(dir, `p${padded}.json`));
          const pbExists = existsSync(path.join(dir, `p${padded}.pb`));
          if (jsonExists && pbExists) {
            stats.skipped++;
            continue;
          }
        }

        try {
          const payload = generatePayload(collected.words, code, page);
          if (!payload.lines.length) throw new Error("No lines generated");

          await Bun.write(path.join(dir, `p${padded}.json`), JSON.stringify(payload));
          const buffer = encodeMushafPagePayload(payload);
          await Bun.write(path.join(dir, `p${padded}.pb`), buffer);
          stats.success++;
        } catch (error: unknown) {
          const err = error as Error;
          console.error(`\nFailed encoding p${page}/${code}: ${err.message}`);
          stats.errors[err.message.includes("Encoding") ? "Encoding Fail" : "Other"]++;
        }
      }

      doneTasks++;
      updateProgress(doneTasks, totalTasks);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  await persistFootnotes(footnoteAssetPath, footnotesByTranslation);

  process.stdout.write("\n");
  printSummary(statsByCode);
}

// ---------------------------------------------------------------------------
// Payload generation
// ---------------------------------------------------------------------------
function generatePayload(
  resolvedWords: ResolvedWord[],
  code: MushafCode,
  page: number,
): MushafPagePayload {
  const textField = TEXT_FIELD_BY_CODE[code];
  const lineField = LINE_FIELD_BY_CODE[code];
  const fontPageField = FONT_PAGE_FIELD_BY_CODE[code];

  const linesMap = new Map<
    number,
    { text: string; verseKey: string; x: number; width: number; charTypeName: string }[]
  >();
  let maxLine = 0;

  for (const { word: wordData, verse_key } of resolvedWords) {
    // Only keep word-type tokens we care about.
    const charType = wordData.char_type_name;
    if (charType && charType !== "word" && charType !== "end" && charType !== "pause") {
      continue;
    }

    // The font-file page is the authoritative source for which page this word
    // renders on. Discard words belonging to a different font page.
    const fontPage = wordData[fontPageField];
    if (typeof fontPage === "number" && fontPage !== page) continue;

    // Resolve the line number.
    const lineNumRaw = wordData[lineField];
    const lineNum =
      typeof lineNumRaw === "number" && lineNumRaw > 0
        ? lineNumRaw
        : typeof wordData.line_number === "number" && wordData.line_number > 0
          ? wordData.line_number
          : 1;
    maxLine = Math.max(maxLine, lineNum);

    const rawText = getWordText(wordData, textField);
    if (!rawText) continue;

    const existing = linesMap.get(lineNum) ?? [];
    const x = existing.length * AVG_CHAR_WIDTH;
    const width = Math.max(1, [...rawText].length) * AVG_CHAR_WIDTH;
    existing.push({
      text: rawText,
      verseKey: verse_key,
      x,
      width,
      charTypeName: charType ?? "word",
    });
    linesMap.set(lineNum, existing);
  }

  const lines: MushafPagePayload["lines"] = [];
  for (let i = 1; i <= maxLine; i++) {
    const words = linesMap.get(i);
    if (words?.length) lines.push({ lineNumber: i, words });
  }
  return { page, mushafCode: code, lines };
}

function getWordText(word: VerseWord, preferredField: keyof VerseWord): string {
  const candidates: (keyof VerseWord)[] = [preferredField, "code_v2", "text_qpc_hafs", "text"];
  for (const key of candidates) {
    const value = normalizeWordText(word[key]);
    if (value) return value;
  }
  return "";
}

function normalizeWordText(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const trimmed = cleaned.trim();
  if (!trimmed) return "";
  return decodeNumericHtmlEntities(trimmed);
}

function decodeNumericHtmlEntities(input: string): string {
  return input.replace(/&#(x?[0-9a-fA-F]+);?/g, (_m, raw) => {
    const base = raw[0].toLowerCase() === "x" ? 16 : 10;
    const digits = base === 16 ? raw.slice(1) : raw;
    const cp = Number.parseInt(digits, base);
    if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return _m;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return _m;
    }
  });
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
  const table: Record<string, unknown> = {};
  for (const [code, s] of statsByCode) {
    const errs = Object.values(s.errors).reduce((a, b) => a + b, 0);
    table[code] = { success: s.success, skipped: s.skipped, errors: errs };
  }
  console.table(table);
  const totalErrors = [...statsByCode.values()].reduce(
    (sum, s) => sum + Object.values(s.errors).reduce((a, b) => a + b, 0),
    0,
  );
  if (totalErrors > 0) {
    console.error(`\n${totalErrors} errors occurred. Re-run without --force to fill gaps.`);
  }
}

function parseCodesArg(codesArg: string | null, codeArg: string | null): MushafCode[] {
  const raw = codesArg ?? codeArg;
  if (!raw || raw === "all") return ALL_CODES;
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

async function loadExistingFootnotes(
  filePath: string,
): Promise<Record<FootnoteTranslationId, Record<string, string>>> {
  const template = FOOTNOTE_TRANSLATIONS.reduce(
    (acc, id) => { acc[id] = {}; return acc; },
    {} as Record<FootnoteTranslationId, Record<string, string>>,
  );
  if (!existsSync(filePath)) return template;
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    for (const translationId of FOOTNOTE_TRANSLATIONS) {
      const entries = parsed?.[translationId];
      if (entries && typeof entries === "object") {
        Object.assign(template[translationId], entries);
      }
    }
  } catch {
    // Ignore parse errors; keep the empty template
  }
  return template;
}

async function persistFootnotes(
  filePath: string,
  data: Record<FootnoteTranslationId, Record<string, string>>,
) {
  await Bun.write(filePath, JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
