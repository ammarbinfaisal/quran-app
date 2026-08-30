import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { searchIndex } from "./engine";
import { parseSearchIndex } from "./format";
import { normalizeArabic, normalizeArabicWithElisions } from "./normalize";
import { alignSegmentStarts, verseSegments, type MorphologySegment } from "./segments";
import { SEARCH_EMPTY_QUERY_ERROR, SEARCH_INDEX_FILE } from "./constants";

const root = process.cwd();

function loadIndex() {
  const file = fs.readFileSync(path.join(root, SEARCH_INDEX_FILE));
  return parseSearchIndex(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
}

interface ReferenceVerse {
  verse_key: string;
  /** normalized text as code points */
  chars: string[];
  /** offsets where a morphological segment starts (word starts included) */
  segmentStarts: Set<number>;
  /** offsets a match may start at: word starts plus prefix and stem starts */
  matchStarts: Set<number>;
  /** offset → letter the mushaf writes only as a mark right before it */
  elidedBefore: Map<number, string>;
}

/** Built from the raw sources (not the .bin), so it also validates the generated tables. */
function loadVerses(): ReferenceVerse[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(root, "rust-api", "data", "quran-uthmani.json"), "utf8"),
  ) as { verses: Array<{ verse_key: string; text_uthmani: string }> };
  const segments = verseSegments(
    JSON.parse(fs.readFileSync(path.join(root, "public", "data", "morphology.json"), "utf8")) as Record<
      string,
      MorphologySegment[]
    >,
  );
  return raw.verses.map((v) => {
    const { text, elisions } = normalizeArabicWithElisions(v.text_uthmani);
    const chars = [...text];
    const segmentStarts = new Set<number>();
    const matchStarts = new Set<number>();
    chars.forEach((c, i) => {
      if (c !== " " && (i === 0 || chars[i - 1] === " ")) {
        segmentStarts.add(i);
        matchStarts.add(i);
      }
    });
    const segs = segments.get(v.verse_key) ?? [];
    const aligned = alignSegmentStarts(text, segs.map((s) => s.form));
    aligned?.starts.forEach((offset, j) => {
      if (offset >= chars.length) return;
      segmentStarts.add(offset);
      if (!segs[j].suffix) matchStarts.add(offset);
    });
    return {
      verse_key: v.verse_key,
      chars,
      segmentStarts,
      matchStarts,
      elidedBefore: new Map(elisions.map((e) => [e.offset, e.letter])),
    };
  });
}

const ELIDABLE = new Set(["ا", "و", "ي", "ن"]);

/**
 * Reference implementation: a match starts at a word, prefix or stem start;
 * letters are contiguous; a query space matches a text space or a zero-width
 * segment boundary; an elidable query letter may match the mark the mushaf
 * uses for it (but a match cannot begin with such a mark). Mushaf order.
 */
function bruteForce(verses: ReferenceVerse[], query: string): string[] {
  const q = [...normalizeArabic(query)];
  if (q.length === 0) return [];

  const matchFrom = (v: ReferenceVerse, i: number, qi: number, lastElided: number): boolean => {
    if (qi === q.length) return true;
    const c = q[qi];
    if (c === " ") {
      if (v.chars[i] === " ") return matchFrom(v, i + 1, qi + 1, lastElided);
      return v.segmentStarts.has(i) && matchFrom(v, i, qi + 1, lastElided);
    }
    if (v.chars[i] === c && matchFrom(v, i + 1, qi + 1, lastElided)) return true;
    return ELIDABLE.has(c) && lastElided !== i && v.elidedBefore.get(i) === c && matchFrom(v, i, qi + 1, i);
  };

  return verses
    .filter((v) => [...v.matchStarts].some((p) => matchFrom(v, p, 0, p)))
    .map((v) => v.verse_key);
}

const index = loadIndex();
const verses = loadVerses();

function keys(query: string, limit = 10_000): string[] {
  const outcome = searchIndex(index, query, limit);
  expect(outcome.ok).toBe(true);
  return outcome.ok ? outcome.response.results.map((r) => r.verse_key) : [];
}

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

  test("matches in mushaf order, honouring limit", () => {
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

  test("matches at segment starts only, never inside a stem", () => {
    // رحمن is the stem of الرحمن, so it finds every الرحمن plus the bare ones (17:110).
    const stem = keys("رحمن");
    const withArticle = keys("الرحمن");
    expect(stem.length).toBeGreaterThan(withArticle.length);
    for (const key of withArticle) expect(stem).toContain(key);
    // حمن is inside the stem, and the ما of سماء is not a segment start.
    expect(keys("حمن")).toEqual([]);
    expect(keys("ماء")).not.toContain("2:19"); // ...كَصَيِّبٍ مِّنَ ٱلسَّمَآءِ...
  });

  describe("segment boundaries", () => {
    test("a query space may sit on a segment boundary: و ما ≡ وما", () => {
      const separated = keys("و ما");
      expect(separated.length).toBeGreaterThan(100);
      // The mushaf never writes و as its own word, so both spellings agree exactly.
      expect(separated).toEqual(keys("وما"));
      expect(separated).toContain("2:9"); // وَمَا يَخْدَعُونَ
    });

    test("a stem inside a word is a match start: ما finds وما / فما / بما", () => {
      const ma = new Set(keys("ما"));
      expect(ma.has("2:9")).toBe(true); // only وَمَا, no word-initial ما
      expect(ma.has("2:26")).toBe(true); // مَا بَعُوضَةً
      expect(ma.has("2:23")).toBe(true); // مِّمَّا نَزَّلْنَا (م + ما)
      expect(keys("ماذا")).toContain("2:26");
    });

    test("a prefix inside a word is a match start: الحمد finds والحمد", () => {
      expect(keys("الحمد")).toContain("6:45"); // وَٱلْحَمْدُ لِلَّهِ
      expect(keys("الله")).toContain("2:9"); // وَٱللَّهَ
      expect(keys("بالله")).toContain("2:8"); // ءَامَنَّا بِٱللَّهِ
    });

    test("a suffix clitic is not a match start: هم does not find رزقناهم", () => {
      // 2:3 has رَزَقْنَـٰهُمْ but no standalone هم.
      expect(keys("هم")).not.toContain("2:3");
      // A query space still may fall on the suffix boundary.
      expect(keys("رب هم")).toEqual(keys("ربهم"));
      expect(keys("ربهم").length).toBeGreaterThan(50);
      expect(keys("ر بهم")).toEqual([]);
    });

    test("mixed gaps: real spaces and boundaries in one phrase", () => {
      // بِسْمِ ٱللَّهِ = ب + سم, then a real space.
      expect(keys("ب سم الله")).toEqual(keys("بسم الله"));
      expect(keys("و ما يخدعون")).toEqual(keys("وما يخدعون"));
    });
  });

  describe("elided letters", () => {
    test("يا ايها matches يَـٰٓأَيُّهَا (dagger alef + segment boundary)", () => {
      const spaced = keys("يا ايها");
      expect(spaced.length).toBeGreaterThan(100);
      expect(spaced).toContain("2:21");
      expect(spaced).toEqual(keys("يايها"));
      expect(keys("يا ايها الذين امنوا")).toContain("2:104");
    });

    test("dagger alef is optional: both modern and mushaf spellings match", () => {
      expect(keys("العالمين")).toContain("1:2");
      expect(keys("العلمين")).toContain("1:2");
      expect(keys("الحمد لله رب العالمين")).toEqual(["1:2", "6:45", "10:10", "37:182", "39:75", "40:65"]);
      expect(keys("ذلك")).toContain("2:2");
      expect(keys("هذا")).toContain("2:25");
      expect(keys("السماوات والارض")).toContain("2:33");
      expect(keys("الكتاب")).toContain("2:2");
      expect(keys("الرحمن")).toContain("1:1");
      expect(keys("الرحمان")).toContain("1:1"); // the dagger is there too
    });

    test("waw seat, small yeh and hamza on tatweel", () => {
      expect(keys("الصلاة")).toContain("2:3"); // ٱلصَّلَوٰةَ
      expect(keys("الزكاة")).toContain("2:43");
      expect(keys("الحياة الدنيا")).toContain("2:85");
      expect(keys("ابراهيم")).toContain("2:124"); // إِبْرَٰهِـۧمَ
      expect(keys("النبيين")).toContain("2:61"); // ٱلنَّبِيِّـۧنَ
      expect(keys("شيئا")).toContain("2:48"); // شَيْـًٔا
      expect(keys("الآخرة")).toContain("2:4"); // ٱلْـَٔاخِرَةِ
      expect(keys("بآياتنا")).toContain("2:39"); // بِـَٔايَـٰتِنَا
      expect(keys("على")).toContain("2:5"); // عَلَىٰ
    });

    test("a hamza before an alef reads as آ", () => {
      expect(keys("امنوا")).toContain("2:9"); // ءَامَنُوا۟
      expect(keys("آمنوا")).toContain("2:9");
      expect(keys("الذين آمنوا")).toContain("2:9");
      expect(keys("القرآن")).toContain("2:185"); // ٱلْقُرْءَانُ
      expect(keys("آيات")).toContain("2:39"); // بِـَٔايَـٰتِنَا: ب + ايت
      expect(keys("آدم")).toContain("2:31"); // ءَادَمَ
    });
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
      // segment boundaries
      "و ما",
      "ف ما",
      "و ال",
      "ال حمد",
      "رب هم",
      "ب ما",
      "و ل",
      "ا ل",
      "و الذين امن وا",
      "و ما يخدعون الا انفس هم",
      "بعد ما",
      "الاخره",
      "ل اخره",
      "ب ال اخره",
      "و ه",
      "و و",
      "هم",
      "كم",
      "ماء",
      // elisions
      "العالمين",
      "العلمين",
      "السماوات",
      "السموات",
      "السماوات والارض",
      "الصلاة",
      "الصلوة",
      "الحياة",
      "ابراهيم",
      "ابرهيم",
      "النبيين",
      "شيئا",
      "شيا",
      "ياايها",
      "يا ايها",
      "ي ايها",
      "يايها",
      "هذا",
      "هاذا",
      "ذلك",
      "ذالك",
      "على",
      "عليا",
      "اسرائيل",
      "له",
      "لهو",
      "به",
      "بهي",
      "ننجي",
      "ا ا ا",
      "و ا و ا",
      "امنوا",
      "ءامنوا",
      "الحمد",
      "الله",
      "بالله",
      "ل",
      "ال",
      "لل",
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
