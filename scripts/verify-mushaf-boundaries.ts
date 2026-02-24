import path from "node:path";
import { existsSync } from "node:fs";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";
import type { MushafPagePayload } from "../src/lib/mushaf/proto";

// Checks that the locally generated mushaf payload matches the API's page-boundary
// data when filtered by the font-rendering page (v2_page) and line number (line_v2).
//
// Usage:
//   bun scripts/verify-mushaf-boundaries.ts --samples 50 --seed 123
//   bun scripts/verify-mushaf-boundaries.ts --pages 588-589

const API_BASE = "https://api.quran.com/api/v4";
const WORD_FIELDS = ["code_v2", "v2_page", "line_v2"].join(",");

type ApiWord = {
  char_type_name?: string;
  position?: number;
  code_v2?: string;
  text?: string;
  v2_page?: number;
  line_v2?: number;
  line_number?: number;
};

type ApiVerse = { verse_key: string; words?: ApiWord[] };

type ExpectedWord = { verseKey: string; text: string; charTypeName: string; lineNumber: number };

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

function padPage(page: number) {
  return String(page).padStart(3, "0");
}

function parseVerseKey(verseKey: string) {
  const [s, v] = verseKey.split(":");
  return { surahId: Number.parseInt(s ?? "", 10) || 0, verseId: Number.parseInt(v ?? "", 10) || 0 };
}

function charTypeRank(t: string | undefined) {
  if (t === "word") return 0;
  if (t === "pause") return 1;
  if (t === "end") return 2;
  return 3;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function fetchVersesByPage(page: number, mushafId: number): Promise<ApiVerse[]> {
  const url =
    `${API_BASE}/verses/by_page/${page}` +
    `?language=ar&words=true&per_page=50&word_fields=${encodeURIComponent(WORD_FIELDS)}&mushaf=${mushafId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { verses?: ApiVerse[] };
  return data.verses ?? [];
}

async function expectedWordsForPage(page: number, mushafId: number): Promise<ExpectedWord[]> {
  const apiPages = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= TOTAL_PAGES);
  const responses = await Promise.all(apiPages.map((p) => fetchVersesByPage(p, mushafId)));
  const verses = responses.flat();

  const out: Array<ExpectedWord & { position: number; surahId: number; verseId: number }> = [];
  for (const verse of verses) {
    const { surahId, verseId } = parseVerseKey(verse.verse_key);
    const words = verse.words ?? [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      const charType = w.char_type_name ?? "word";
      if (charType !== "word" && charType !== "end" && charType !== "pause") continue;
      if (typeof w.v2_page === "number" && w.v2_page !== page) continue;

      const lineNumberRaw = w.line_v2;
      const lineNumber =
        typeof lineNumberRaw === "number" && lineNumberRaw > 0
          ? lineNumberRaw
          : typeof w.line_number === "number" && w.line_number > 0
            ? w.line_number
            : 1;

      const text = normalizeText(w.code_v2 ?? w.text);
      if (!text) continue;

      const position = typeof w.position === "number" && w.position > 0 ? w.position : i + 1;
      out.push({
        verseKey: verse.verse_key,
        text,
        charTypeName: charType,
        lineNumber,
        position,
        surahId,
        verseId,
      });
    }
  }

  out.sort((a, b) => {
    if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
    if (a.surahId !== b.surahId) return a.surahId - b.surahId;
    if (a.verseId !== b.verseId) return a.verseId - b.verseId;
    if (a.position !== b.position) return a.position - b.position;
    return charTypeRank(a.charTypeName) - charTypeRank(b.charTypeName);
  });

  return out.map(({ surahId: _s, verseId: _v, position: _p, ...rest }) => rest);
}

function payloadWordsByLine(payload: MushafPagePayload) {
  const map = new Map<number, ExpectedWord[]>();
  for (const line of payload.lines) {
    map.set(
      line.lineNumber,
      line.words.map((w) => ({
        verseKey: w.verseKey,
        text: w.text,
        charTypeName: w.charTypeName,
        lineNumber: line.lineNumber,
      })),
    );
  }
  return map;
}

function groupExpectedByLine(words: ExpectedWord[]) {
  const map = new Map<number, ExpectedWord[]>();
  for (const w of words) {
    const arr = map.get(w.lineNumber) ?? [];
    arr.push(w);
    map.set(w.lineNumber, arr);
  }
  return map;
}

function stableSamplePages(samples: number, seed: number) {
  const picked = new Set<number>();
  let state = seed >>> 0;
  const nextU32 = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };

  while (picked.size < Math.min(samples, TOTAL_PAGES)) {
    const n = (nextU32() % TOTAL_PAGES) + 1;
    picked.add(n);
  }
  return [...picked].sort((a, b) => a - b);
}

async function main() {
  const mushafCode = (getArg("--code") ?? "v2") as MushafCode;
  if (mushafCode !== "v2") {
    console.error(`Only mushafCode=v2 is supported right now (got ${mushafCode}).`);
    process.exit(2);
  }
  const mushafId = 1;

  const pagesArg = getArg("--pages");
  const samples = Number(getArg("--samples") ?? "25");
  const seed = Number(getArg("--seed") ?? "123");
  const strict = hasFlag("--strict");

  const pages = pagesArg
    ? (() => {
        if (pagesArg.includes(",")) return pagesArg.split(",").map((p) => Number(p.trim())).filter(Boolean);
        const { start, end } = parsePageRange(pagesArg);
        const out: number[] = [];
        for (let p = Math.max(1, start); p <= Math.min(end, TOTAL_PAGES); p++) out.push(p);
        return out;
      })()
    : stableSamplePages(samples, seed);

  const publicRoot = path.join(process.cwd(), "public");
  const dataDir = path.join(publicRoot, "mushaf-data", mushafCode);

  let checked = 0;
  const mismatches: Array<{ page: number; lineNumber: number; reason: string }> = [];

  for (const page of pages) {
    const file = path.join(dataDir, `p${padPage(page)}.json`);
    if (!existsSync(file)) {
      mismatches.push({ page, lineNumber: -1, reason: `Missing file: ${file}` });
      continue;
    }
    const payload = (await Bun.file(file).json()) as MushafPagePayload;

    const expected = await expectedWordsForPage(page, mushafId);
    const expectedByLine = groupExpectedByLine(expected);
    const gotByLine = payloadWordsByLine(payload);

    const allLineNumbers = new Set<number>([...expectedByLine.keys(), ...gotByLine.keys()]);
    for (const lineNumber of [...allLineNumbers].sort((a, b) => a - b)) {
      const exp = expectedByLine.get(lineNumber) ?? [];
      const got = gotByLine.get(lineNumber) ?? [];

      if (exp.length !== got.length) {
        mismatches.push({
          page,
          lineNumber,
          reason: `Length mismatch: expected=${exp.length} got=${got.length}`,
        });
        if (strict) break;
        continue;
      }

      for (let i = 0; i < exp.length; i++) {
        const e = exp[i]!;
        const g = got[i]!;
        if (e.verseKey !== g.verseKey || e.text !== g.text || e.charTypeName !== g.charTypeName) {
          mismatches.push({
            page,
            lineNumber,
            reason: `Token mismatch at index ${i}: expected=${e.verseKey}/${e.charTypeName} got=${g.verseKey}/${g.charTypeName}`,
          });
          break;
        }
      }
      if (strict && mismatches.length) break;
    }

    checked++;
  }

  if (!mismatches.length) {
    console.log(`OK: verified ${checked} page(s): boundary coverage matches API (code=${mushafCode}).`);
    return;
  }

  console.error(`FAIL: ${mismatches.length} mismatch(es) across ${checked} page(s) (code=${mushafCode}).`);
  for (const m of mismatches.slice(0, 25)) {
    console.error(`- p${m.page} line ${m.lineNumber}: ${m.reason}`);
  }
  if (mismatches.length > 25) console.error(`- ... and ${mismatches.length - 25} more`);
  process.exit(1);
}

await main();

