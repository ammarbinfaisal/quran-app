/**
 * Arabic search normalization — an exact port of rust-api/src/normalization.rs.
 *
 * Both the index generator and every query go through this function, so the
 * contract must stay byte-identical on the server, in the browser, and in the
 * build script.
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

function shouldKeepChar(ch: string, cp: number): boolean {
  return ALPHANUMERIC_RE.test(ch) || inRanges(cp, ARABIC_LETTER_RANGES);
}

export function normalizeArabic(input: string): string {
  let out = "";
  let lastWasSpace = true;

  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (isRemovedMark(cp)) continue;

    const mapped = ch in CHAR_MAP ? CHAR_MAP[ch] : ch;
    if (mapped === "") continue;

    if (WHITESPACE_RE.test(mapped)) {
      if (!lastWasSpace) {
        out += " ";
        lastWasSpace = true;
      }
      continue;
    }

    if (shouldKeepChar(mapped, mapped.codePointAt(0)!)) {
      out += mapped;
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      out += " ";
      lastWasSpace = true;
    }
  }

  return out.trim();
}
