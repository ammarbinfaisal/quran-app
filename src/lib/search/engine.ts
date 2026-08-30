import { normalizeArabic } from "./normalize";
import { CODE_SPACE, isSegmentStart, type SearchIndex } from "./format";
import { SEARCH_EMPTY_QUERY_ERROR } from "./constants";
import type { QuranSearchResponse } from "./types";

export type SearchOutcome =
  | { ok: true; response: QuranSearchResponse }
  | { ok: false; error: string; status: number };

/**
 * Matching rules
 *
 * A match starts at a word start or at the start of a prefix or stem inside a
 * word (so ما finds وما, فما and بما and الحمد finds والحمد, while the suffix
 * clitic هم does not make ربهم a hit for هم) and must then reproduce the query
 * contiguously. Two things are flexible along the way:
 *
 *   - a query space matches a real space or a zero-width morphological segment
 *     boundary (format.ts `segStart`), so "و ما" ≡ "وما" and "رب هم" ≡ "ربهم";
 *   - a query letter that the mushaf writes only as a small mark (dagger alef,
 *     small yeh/waw/noon — format.ts `elidedBefore`) may match that mark, so
 *     العالمين and العلمين both find ٱلْعَـٰلَمِينَ, and ابراهيم finds إِبْرَٰهِـۧمَ.
 *
 * The query is walked as a trie over the suffix array: every letter narrows the
 * current [lo,hi) range, each flexible choice forks the walk, and forks whose
 * range becomes empty die immediately, so only spellings that actually occur in
 * the corpus are ever explored. Zero-width choices are checked per hit at the
 * end because they do not change the suffix-array range.
 */
const MAX_JOINS = 8;
const MAX_ELISIONS = 4;
/** Safety valve against pathological queries; beyond it the walk stops forking. */
const NODE_BUDGET = 20_000;

/** Letters the mushaf sometimes leaves unwritten (see normalize.ts). */
const ELIDABLE_LETTERS = ["ا", "و", "ي", "ن"];

/** Narrow [lo,hi) — entries sharing the first `m` codes — to those whose next code is `code`. */
function refine(index: SearchIndex, lo: number, hi: number, m: number, code: number): [number, number] {
  if (m === 0) return [index.prefix1[2 * code], index.prefix1[2 * code + 1]];
  const { text, sa } = index;
  let a = lo;
  let b = hi;
  while (a < b) {
    const mid = (a + b) >>> 1;
    if (text[sa[mid] + m] < code) a = mid + 1;
    else b = mid;
  }
  const start = a;
  b = hi;
  while (a < b) {
    const mid = (a + b) >>> 1;
    if (text[sa[mid] + m] <= code) a = mid + 1;
    else b = mid;
  }
  return [start, a];
}

export function verseKeyAt(index: SearchIndex, verse: number): string {
  return `${index.surah[verse]}:${index.ayah[verse]}`;
}

interface Walk {
  index: SearchIndex;
  query: Uint8Array;
  elidable: Set<number>;
  hit: Uint8Array;
  total: number;
  nodes: number;
}

/** Record every verse in sa[lo,hi) whose zero-width requirements hold. */
function collect(w: Walk, lo: number, hi: number, joins: readonly number[], elisions: readonly number[]): void {
  const { index, hit } = w;
  for (let k = lo; k < hi; k++) {
    const p = index.sa[k];
    let ok = true;
    for (let i = 0; ok && i < joins.length; i++) ok = isSegmentStart(index, p + joins[i]);
    for (let i = 0; ok && i < elisions.length; i += 2) ok = index.elidedBefore.get(p + elisions[i]) === elisions[i + 1];
    if (!ok) continue;
    const v = index.saVerse[k];
    if (hit[v] === 0) {
      hit[v] = 1;
      w.total++;
    }
  }
}

/**
 * @param qi    next query code to consume
 * @param m     text codes matched so far (offset from the match start)
 * @param joins offsets that must be segment starts
 * @param elisions flat [offset, code, offset, code, …] of letters matched as marks
 */
function walk(
  w: Walk,
  qi: number,
  lo: number,
  hi: number,
  m: number,
  joins: readonly number[],
  elisions: readonly number[],
): void {
  if (lo >= hi) return;
  if (qi === w.query.length) {
    collect(w, lo, hi, joins, elisions);
    return;
  }
  if (++w.nodes > NODE_BUDGET) return;

  const code = w.query[qi];
  const [l, h] = refine(w.index, lo, hi, m, code);
  walk(w, qi + 1, l, h, m + 1, joins, elisions);

  if (m === 0) return; // nothing zero-width can precede the first letter
  if (code === CODE_SPACE) {
    if (joins.length < MAX_JOINS) walk(w, qi + 1, lo, hi, m, [...joins, m], elisions);
  } else if (w.elidable.has(code)) {
    const alreadyElidedHere = elisions.length > 0 && elisions[elisions.length - 2] === m;
    if (!alreadyElidedHere && elisions.length < 2 * MAX_ELISIONS) {
      walk(w, qi + 1, lo, hi, m, joins, [...elisions, m, code]);
    }
  }
}

/** Map a normalized query to index codes; null when a char is absent from the corpus. */
function encodeQuery(index: SearchIndex, normalized: string): Uint8Array | null {
  const codes: number[] = [];
  for (const ch of normalized) {
    const code = index.codeOf.get(ch.codePointAt(0)!);
    if (code === undefined) return null;
    codes.push(code);
  }
  return Uint8Array.from(codes);
}

export function searchIndex(index: SearchIndex, query: string, limit: number): SearchOutcome {
  const normalized = normalizeArabic(query);
  if (!normalized) return { ok: false, error: SEARCH_EMPTY_QUERY_ERROR, status: 400 };

  const base: Omit<QuranSearchResponse, "total_matches" | "limited_to" | "results"> = {
    query,
    normalized_query: normalized,
    cache_hit: false,
  };

  const codes = encodeQuery(index, normalized);
  if (!codes) {
    return { ok: true, response: { ...base, total_matches: 0, limited_to: 0, results: [] } };
  }

  const elidable = new Set<number>();
  for (const letter of ELIDABLE_LETTERS) {
    const code = index.codeOf.get(letter.codePointAt(0)!);
    if (code !== undefined) elidable.add(code);
  }

  // Dedupe occurrences into verses; a bitmap keeps mushaf order for free.
  const w: Walk = { index, query: codes, elidable, hit: new Uint8Array(index.verseCount), total: 0, nodes: 0 };
  walk(w, 0, 0, index.sa.length, 0, [], []);

  const results: QuranSearchResponse["results"] = [];
  for (let v = 0; v < w.hit.length && results.length < limit; v++) {
    if (w.hit[v]) results.push({ verse_key: verseKeyAt(index, v) });
  }

  return {
    ok: true,
    response: { ...base, total_matches: w.total, limited_to: results.length, results },
  };
}
