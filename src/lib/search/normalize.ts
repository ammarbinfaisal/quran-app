/**
 * Arabic search normalization, shared by the index generator, the server and
 * the browser — the contract must stay byte-identical everywhere.
 *
 * Besides folding diacritics and letter variants, `normalizeArabicWithElisions`
 * reports letters the mushaf writes only as small marks (dagger alef, small
 * yeh/waw/noon, hamza on a tatweel) so that a query spelled the modern way
 * (العالمين, ابراهيم, شيئا) can still match the Uthmani text (ٱلْعَـٰلَمِينَ,
 * إِبْرَٰهِـۧمَ, شَيْـًٔا). The engine treats such a letter as optional at that
 * position, which also keeps ذلك matching ذَٰلِكَ.
 */

const REMOVED_MARK_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0610, 0x061a], // honorifics
  [0x064b, 0x065f], // harakat, tanween, shadda, sukun
  [0x0670, 0x0670], // superscript alef
  [0x06d6, 0x06ed], // Quranic annotation marks
  [0x08d3, 0x08ff], // extended Arabic marks
];

const ARABIC_LETTER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0621, 0x063a],
  [0x0641, 0x064a],
  [0x066e, 0x06d3],
  [0x06fa, 0x06ff],
];

const CHAR_MAP: Readonly<Record<string, string>> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ى": "ي",
  "ی": "ي",
  "ؤ": "و",
  "ئ": "ي",
  "ة": "ه",
  "ک": "ك",
  "ـ": "", // tatweel is dropped entirely
};

/** Marks that stand for a letter the mushaf does not write out. */
const ELIDED_LETTER_MARKS: ReadonlyMap<number, string> = new Map([
  [0x06e5, "و"], // small waw: لَهُۥ
  [0x06e6, "ي"], // small yeh: بِهِۦ
  [0x06e7, "ي"], // small high yeh: إِبْرَٰهِـۧمَ, ٱلنَّبِيِّـۧنَ
  [0x06e8, "ن"], // small high noon: نُـۨجِى
]);

const SUPERSCRIPT_ALEF = 0x0670;
const HAMZA_ABOVE = 0x0654;
const TATWEEL = 0x0640;
const ALEF = 0x0627;
const WAW = 0x0648;
const ALEF_MAQSURA = 0x0649;
const YEH = 0x064a;

const ALPHANUMERIC_RE = /^[\p{Alphabetic}\p{N}]$/u;
const WHITESPACE_RE = /^\s$/u;

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function isRemovedMark(cp: number): boolean {
  return inRanges(cp, REMOVED_MARK_RANGES);
}

/** Fathatan … sukun (U+064B–U+0652). */
function isHaraka(cp: number): boolean {
  return cp >= 0x064b && cp <= 0x0652;
}

function shouldKeepChar(ch: string, cp: number): boolean {
  return ALPHANUMERIC_RE.test(ch) || inRanges(cp, ARABIC_LETTER_RANGES);
}

export interface Elision {
  /** Code-point offset in the normalized text where the letter would be inserted. */
  offset: number;
  /** The normalized letter the mark stands for (ا, و, ي or ن). */
  letter: string;
}

export interface NormalizedArabic {
  text: string;
  elisions: Elision[];
}

export function normalizeArabicWithElisions(input: string): NormalizedArabic {
  let out = "";
  let outLength = 0; // code points in `out`
  let lastWasSpace = true;
  let prev = -1; // previous raw code point
  let prevBase = -1; // previous raw code point that is not a haraka
  const elisions: Elision[] = [];

  const elide = (letter: string) => {
    if (lastWasSpace) return; // a word never starts with an elided letter
    const last = elisions[elisions.length - 1];
    if (last && last.offset === outLength) return; // one slot per position
    elisions.push({ offset: outLength, letter });
  };

  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    const before = prev;
    const beforeBase = prevBase;
    prev = cp;
    if (!isHaraka(cp)) prevBase = cp;

    if (cp === SUPERSCRIPT_ALEF) {
      if (before === WAW && out.endsWith("و")) {
        // The waw is only a seat for the alef (ٱلصَّلَوٰةَ): read it as الصلاه.
        out = out.slice(0, -1) + "ا";
      } else if (before !== ALEF_MAQSURA && before !== YEH) {
        // عَلَىٰ already reads علي; elsewhere the alef is genuinely unwritten.
        elide("ا");
      }
      continue;
    }
    if (cp === HAMZA_ABOVE) {
      // A hamza carried by a tatweel (شَيْـًٔا, ٱلسَّيِّـَٔاتِ) is written ئ today, which folds to ي.
      // Its haraka may be encoded on either side of it.
      if (beforeBase === TATWEEL) elide("ي");
      continue;
    }
    const elided = ELIDED_LETTER_MARKS.get(cp);
    if (elided !== undefined) {
      elide(elided);
      continue;
    }
    if (isRemovedMark(cp)) continue;

    const mapped = ch in CHAR_MAP ? CHAR_MAP[ch] : ch;
    if (mapped === "") continue;

    if (WHITESPACE_RE.test(mapped)) {
      if (!lastWasSpace) {
        out += " ";
        outLength++;
        lastWasSpace = true;
      }
      continue;
    }

    if (shouldKeepChar(mapped, mapped.codePointAt(0)!)) {
      if (cp === ALEF && out.endsWith("ء")) {
        // The mushaf writes آ as a hamza before the alef (ءَامَنُوا۟, ٱلْقُرْءَانَ); fold it like آ.
        out = out.slice(0, -1);
        outLength--;
      }
      out += mapped;
      outLength++;
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      out += " ";
      outLength++;
      lastWasSpace = true;
    }
  }

  // Only a trailing space can be trimmed (leading ones are never emitted), so offsets stay valid.
  return { text: out.trim(), elisions };
}

export function normalizeArabic(input: string): string {
  return normalizeArabicWithElisions(input).text;
}

/** Number of searchable characters (spaces excluded) left after normalization. */
export function countSearchLetters(input: string): number {
  let count = 0;
  for (const ch of normalizeArabic(input)) {
    if (ch !== " ") count++;
  }
  return count;
}
