import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { searchIndex } from "./engine";
import { parseSearchIndex } from "./format";
import { normalizeArabic } from "./normalize";
import { SEARCH_EMPTY_QUERY_ERROR, SEARCH_INDEX_FILE } from "./constants";

const root = process.cwd();

function loadIndex() {
  const file = fs.readFileSync(path.join(root, SEARCH_INDEX_FILE));
  return parseSearchIndex(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
}

function loadVerses(): Array<{ verse_key: string; normalized: string }> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(root, "rust-api", "data", "quran-uthmani.json"), "utf8"),
  ) as { verses: Array<{ verse_key: string; text_uthmani: string }> };
  return raw.verses.map((v) => ({ verse_key: v.verse_key, normalized: normalizeArabic(v.text_uthmani) }));
}

/** Reference implementation: word-start contiguous match, mushaf order. */
function bruteForce(verses: ReturnType<typeof loadVerses>, query: string): string[] {
  const nq = normalizeArabic(query);
  if (!nq) return [];
  return verses.filter((v) => (" " + v.normalized).includes(" " + nq)).map((v) => v.verse_key);
}

const index = loadIndex();
const verses = loadVerses();

describe("searchIndex", () => {
  test("rejects a query that normalizes to nothing", () => {
    const outcome = searchIndex(index, "،؟", 10);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.error).toBe(SEARCH_EMPTY_QUERY_ERROR);
    }
  });

  test("returns zero matches for characters absent from the corpus", () => {
    const outcome = searchIndex(index, "hello", 10);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.response.total_matches).toBe(0);
      expect(outcome.response.results).toEqual([]);
    }
  });

  test("matches at word starts only, in mushaf order, honouring limit", () => {
    const outcome = searchIndex(index, "الرَّحْمَٰنِ الرَّحِيمِ", 3);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { response } = outcome;
    expect(response.normalized_query).toBe("الرحمن الرحيم");
    expect(response.results.map((r) => r.verse_key)).toEqual(["1:1", "1:3", "2:163"]);
    expect(response.limited_to).toBe(3);
    expect(response.total_matches).toBeGreaterThan(3);
    expect(response.cache_hit).toBe(false);
  });

  test("does not match inside a word", () => {
    const inside = searchIndex(index, "رحمن", 500);
    const wordStart = searchIndex(index, "الرحمن", 500);
    expect(inside.ok && wordStart.ok).toBe(true);
    if (!inside.ok || !wordStart.ok) return;
    // "رحمن" only starts a word in a couple of places (e.g. 17:110), while
    // "الرحمن" appears at a word start throughout the Quran.
    expect(inside.response.total_matches).toBeLessThan(wordStart.response.total_matches);
    expect(inside.response.total_matches).toBe(bruteForce(verses, "رحمن").length);
  });

  test("agrees with the brute-force reference for a range of queries", () => {
    const queries = [
      "ا",
      "ال",
      "الل",
      "الله",
      "بسم الله",
      "الحمد لله رب العالمين",
      "الرحمن الرح",
      "قل هو الله احد",
      "يا ايها الذين امنوا",
      "ولا",
      "ن",
      "و",
      "الم",
      "كهيعص",
      "ذلك الكتاب",
      "إِنَّ ٱلْهُدَىٰ",
      "لله",
      "يوم الدين",
      "الذين",
      "من",
      "ما",
      "لا اله الا",
      "زيد",
      "ابراهيم",
      "xyz",
    ];
    for (const q of queries) {
      const outcome = searchIndex(index, q, 500);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      const expected = bruteForce(verses, q);
      expect(outcome.response.total_matches).toBe(expected.length);
      expect(outcome.response.results.map((r) => r.verse_key)).toEqual(expected.slice(0, 500));
    }
  });
});
