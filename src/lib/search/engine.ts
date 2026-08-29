import { normalizeArabic } from "./normalize";
import type { SearchIndex } from "./format";
import { SEARCH_EMPTY_QUERY_ERROR } from "./constants";
import type { QuranSearchResponse } from "./types";

export type SearchOutcome =
  | { ok: true; response: QuranSearchResponse }
  | { ok: false; error: string; status: number };

/**
 * Compare the suffix starting at text[pos] against the query codes.
 * Returns <0 / 0 / >0 like a comparator; 0 means the query is a prefix of the suffix.
 * The verse separator (code 0) is smaller than any query code, so a suffix that
 * ends before the query does sorts first.
 */
function compareSuffix(text: Uint8Array, pos: number, query: Uint8Array, from: number): number {
  for (let i = from; i < query.length; i++) {
    const t = text[pos + i];
    const q = query[i];
    if (t !== q) return t - q;
  }
  return 0;
}

/** First k in [lo,hi) whose suffix compares >= 0 against the query. */
function lowerBound(index: SearchIndex, query: Uint8Array, from: number, lo: number, hi: number): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareSuffix(index.text, index.sa[mid], query, from) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First k in [lo,hi) whose suffix compares > 0 against the query. */
function upperBound(index: SearchIndex, query: Uint8Array, from: number, lo: number, hi: number): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareSuffix(index.text, index.sa[mid], query, from) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
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

/** [lo,hi) range of `sa` entries whose suffix starts with the query (word-start matches). */
export function findRange(index: SearchIndex, query: Uint8Array): [number, number] {
  const A = index.alphabet.length;
  if (query.length === 0) return [0, 0];

  const c0 = query[0];
  if (query.length === 1) return [index.prefix1[2 * c0], index.prefix1[2 * c0 + 1]];

  const node = 2 * (c0 * A + query[1]);
  const lo = index.prefix2[node];
  const hi = index.prefix2[node + 1];
  if (query.length === 2 || lo >= hi) return [lo, hi];

  // Codes 0..1 are already known equal inside this node; refine on the rest.
  const start = lowerBound(index, query, 2, lo, hi);
  const end = upperBound(index, query, 2, start, hi);
  return [start, end];
}

export function verseKeyAt(index: SearchIndex, verse: number): string {
  return `${index.surah[verse]}:${index.ayah[verse]}`;
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

  const [lo, hi] = findRange(index, codes);

  // Dedupe occurrences into verses; a bitmap keeps mushaf order for free.
  const hit = new Uint8Array(index.verseCount);
  let total = 0;
  for (let k = lo; k < hi; k++) {
    const v = index.saVerse[k];
    if (hit[v] === 0) {
      hit[v] = 1;
      total++;
    }
  }

  const results: QuranSearchResponse["results"] = [];
  for (let v = 0; v < hit.length && results.length < limit; v++) {
    if (hit[v]) results.push({ verse_key: verseKeyAt(index, v) });
  }

  return {
    ok: true,
    response: { ...base, total_matches: total, limited_to: results.length, results },
  };
}
