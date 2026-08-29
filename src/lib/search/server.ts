import fs from "node:fs";
import path from "node:path";
import { parseSearchIndex, type SearchIndex } from "./format";
import { searchIndex, type SearchOutcome } from "./engine";
import { normalizeArabic } from "./normalize";
import type { QuranSearchResponse } from "./types";

let cachedIndex: SearchIndex | null = null;

/** Loads public/data/search-index.bin once per server instance. */
export function getServerSearchIndex(): SearchIndex {
  if (cachedIndex) return cachedIndex;
  // Literal segments (not the shared constant) so Turbopack's file tracer sees one fixed file.
  const file = fs.readFileSync(path.join(process.cwd(), "public", "data", "search-index.bin"));
  // Node Buffers may sit inside a shared pool at an unaligned offset; copy so
  // the typed-array views in parseSearchIndex are 4-byte aligned.
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  cachedIndex = parseSearchIndex(buffer as ArrayBuffer);
  return cachedIndex;
}

const RESULT_CACHE_CAPACITY = 256;
const resultCache = new Map<string, QuranSearchResponse>();

/** Search with a small LRU keyed on the normalized query (populates `cache_hit`). */
export function serverSearch(query: string, limit: number): SearchOutcome {
  const key = `${normalizeArabic(query)} ${limit}`;
  const cached = resultCache.get(key);
  if (cached) {
    resultCache.delete(key);
    resultCache.set(key, cached);
    return { ok: true, response: { ...cached, query, cache_hit: true } };
  }

  const outcome = searchIndex(getServerSearchIndex(), query, limit);
  if (outcome.ok) {
    resultCache.set(key, outcome.response);
    if (resultCache.size > RESULT_CACHE_CAPACITY) {
      const oldest = resultCache.keys().next().value;
      if (oldest !== undefined) resultCache.delete(oldest);
    }
  }
  return outcome;
}
