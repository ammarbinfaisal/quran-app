/**
 * Morphological segment boundaries for the search index.
 *
 * The Quranic Arabic Corpus splits each mushaf word into segments (prefix /
 * stem / suffix), e.g. وما = و + ما, ربهم = رب + هم. Aligning those segments
 * against the normalized verse text gives the positions where a segment starts
 * inside a word, which lets a query written with a space at a segment boundary
 * ("و ما") match the attached mushaf spelling ("وما").
 *
 * Shared by scripts/generate-search-index.ts (builds the bitset) and the engine
 * tests (independent reference implementation).
 */

/** Buckwalter (corpus flavour) → the letter `normalizeArabic` would keep; "" for marks. */
const BUCKWALTER_TO_NORMALIZED: Readonly<Record<string, string>> = {
  // letters
  "'": "ء",
  "|": "ا",
  ">": "ا",
  "<": "ا",
  "{": "ا",
  A: "ا",
  "&": "و",
  "}": "ي",
  Y: "ي",
  y: "ي",
  p: "ه",
  b: "ب",
  t: "ت",
  v: "ث",
  j: "ج",
  H: "ح",
  x: "خ",
  d: "د",
  "*": "ذ",
  r: "ر",
  z: "ز",
  s: "س",
  $: "ش",
  S: "ص",
  D: "ض",
  T: "ط",
  Z: "ظ",
  E: "ع",
  g: "غ",
  f: "ف",
  q: "ق",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  h: "ه",
  w: "و",
  // harakat, tanween, shadda, sukun, superscript alef, tatweel and Quranic
  // annotation marks — all stripped by normalizeArabic.
  F: "",
  N: "",
  K: "",
  a: "",
  u: "",
  i: "",
  "~": "",
  o: "",
  "`": "",
  _: "",
  "^": "",
  "#": "",
  ":": "",
  "@": "",
  '"': "",
  "[": "",
  "]": "",
  ";": "",
  ",": "",
  ".": "",
  "!": "",
  "-": "",
  "+": "",
  "%": "",
  G: "",
};

const HAMZA = "ء";

export interface MorphologySegment {
  segment: number;
  form: string;
  features?: { flags?: string[] };
}

export interface VerseSegment {
  /** Buckwalter form */
  form: string;
  /** SUFFIX clitic (attached pronoun etc.), as opposed to a PREFIX or the STEM. */
  suffix: boolean;
}

/** Ordered segments per verse key from public/data/morphology.json ("s:a:w" → segments). */
export function verseSegments(morphology: Record<string, MorphologySegment[]>): Map<string, VerseSegment[]> {
  const words = new Map<string, Array<{ word: number; segments: MorphologySegment[] }>>();
  for (const [key, segments] of Object.entries(morphology)) {
    const [surah, ayah, word] = key.split(":");
    const verseKey = `${surah}:${ayah}`;
    let list = words.get(verseKey);
    if (!list) words.set(verseKey, (list = []));
    list.push({ word: Number(word), segments });
  }
  const result = new Map<string, VerseSegment[]>();
  for (const [verseKey, list] of words) {
    list.sort((a, b) => a.word - b.word);
    result.set(
      verseKey,
      list.flatMap((w) =>
        [...w.segments]
          .sort((a, b) => a.segment - b.segment)
          .map((s) => ({ form: s.form, suffix: s.features?.flags?.includes("SUFFIX") ?? false })),
      ),
    );
  }
  return result;
}

/** Letters of a Buckwalter segment form as `normalizeArabic` would render them. */
export function buckwalterToNormalizedLetters(form: string): string {
  let out = "";
  let prev = "";
  for (const ch of form) {
    const mapped = BUCKWALTER_TO_NORMALIZED[ch];
    if (mapped === undefined) throw new Error(`unknown Buckwalter character ${JSON.stringify(ch)} in ${form}`);
    // A waw directly carrying a dagger alef is a seat (Sala`p = ٱلصَّلَوٰةَ);
    // normalizeArabic reads it as an alef.
    if (ch === "`" && prev === "w" && out.endsWith("و")) out = out.slice(0, -1) + "ا";
    else out += mapped;
    prev = ch;
  }
  return out;
}

export interface SegmentAlignment {
  /**
   * One entry per input segment: the offset into the normalized verse text
   * where it starts (word starts included). Equal to the text length for a
   * segment the text has no letters left for.
   */
  starts: number[];
  /** Offset just past the last aligned letter; < text length when the corpus is missing words. */
  consumed: number;
}

/**
 * Aligns the ordered corpus segments of one verse against its normalized text.
 *
 * The two sources agree letter-for-letter apart from a bare hamza (ء) that one
 * side writes and the other folds into a neighbouring alef (e.g. corpus
 * الءاخره vs mushaf الاخره), so a hamza is optional on either side. Spaces in
 * the text are skipped freely, which also covers words the corpus joins that
 * the mushaf separates (بعد ما vs بعدما). Returns null when the letters
 * genuinely disagree.
 */
export function alignSegmentStarts(verseText: string, segmentForms: readonly string[]): SegmentAlignment | null {
  const t = [...verseText];
  const starts: number[] = [];
  let i = 0;

  const skipSpaces = () => {
    while (i < t.length && t[i] === " ") i++;
  };

  for (const form of segmentForms) {
    skipSpaces();
    starts.push(i);
    for (const c of buckwalterToNormalizedLetters(form)) {
      skipSpaces();
      if (i < t.length && t[i] === c) {
        i++;
        continue;
      }
      if (c === HAMZA) continue; // corpus hamza the mushaf text lacks
      if (i + 1 < t.length && t[i] === HAMZA && t[i + 1] === c) {
        i += 2; // mushaf hamza the corpus lacks
        continue;
      }
      return null;
    }
  }

  return { starts, consumed: i };
}
