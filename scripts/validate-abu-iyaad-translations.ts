import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type CompactSeg = string | { a: string };
export type AbuIyaadTranslations = Record<string, CompactSeg[]>;

// One-indexed; index zero is intentionally unused.
export const SURAH_VERSE_COUNTS = [
  0,
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
] as const;

export const QURAN_CUMULATIVE: number[] = [0];
for (let surah = 1; surah <= 114; surah++) {
  QURAN_CUMULATIVE[surah] = QURAN_CUMULATIVE[surah - 1] + SURAH_VERSE_COUNTS[surah];
}

export interface TranslationValidationReport {
  verseCount: number;
  uniqueTextCount: number;
  duplicateTextGroupCount: number;
  consecutiveDuplicateCount: number;
}

export function compactSegmentsToText(segments: CompactSeg[]): string {
  return segments
    .map((segment) => typeof segment === "string" ? segment : segment.a)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateAbuIyaadTranslations(
  data: AbuIyaadTranslations,
  minimumVerseCount = 1,
): TranslationValidationReport {
  const entries = Object.entries(data);
  const errors: string[] = [];
  const textsByVerse = new Map<string, string>();
  const versesByText = new Map<string, string[]>();

  if (entries.length < minimumVerseCount) {
    errors.push(`dataset has ${entries.length} verses; expected at least ${minimumVerseCount}`);
  }

  for (const [verseKey, segments] of entries) {
    const match = verseKey.match(/^(\d+):(\d+)$/);
    if (!match) {
      errors.push(`${verseKey}: invalid verse key`);
      continue;
    }

    const surah = Number.parseInt(match[1], 10);
    const ayah = Number.parseInt(match[2], 10);
    if (surah < 1 || surah > 114 || ayah < 1 || ayah > (SURAH_VERSE_COUNTS[surah] ?? 0)) {
      errors.push(`${verseKey}: verse is outside Quran bounds`);
      continue;
    }

    if (!Array.isArray(segments)) {
      errors.push(`${verseKey}: translation must be a compact segment array`);
      continue;
    }

    const text = compactSegmentsToText(segments);
    if (!text) {
      errors.push(`${verseKey}: translation is empty`);
      continue;
    }

    textsByVerse.set(verseKey, text);
    const matchingVerses = versesByText.get(text) ?? [];
    matchingVerses.push(verseKey);
    versesByText.set(text, matchingVerses);
  }

  const consecutiveDuplicates: string[] = [];
  for (let surah = 1; surah <= 114; surah++) {
    for (let ayah = 2; ayah <= SURAH_VERSE_COUNTS[surah]; ayah++) {
      const previousKey = `${surah}:${ayah - 1}`;
      const currentKey = `${surah}:${ayah}`;
      const previousText = textsByVerse.get(previousKey);
      const currentText = textsByVerse.get(currentKey);
      if (previousText && currentText && previousText === currentText) {
        consecutiveDuplicates.push(`${previousKey} and ${currentKey}`);
      }
    }
  }

  if (consecutiveDuplicates.length > 0) {
    errors.push(
      `identical translation text was assigned to consecutive verses: ${consecutiveDuplicates.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Abu Iyaad translation validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    verseCount: entries.length,
    uniqueTextCount: versesByText.size,
    duplicateTextGroupCount: [...versesByText.values()].filter((keys) => keys.length > 1).length,
    consecutiveDuplicateCount: consecutiveDuplicates.length,
  };
}

async function main() {
  const dataPath = join(process.cwd(), "public", "data", "abu-iyaad.json");
  const data = JSON.parse(await readFile(dataPath, "utf8")) as AbuIyaadTranslations;
  const report = validateAbuIyaadTranslations(data);
  console.log(
    `Verified ${report.verseCount} Abu Iyaad translations: ` +
    `${report.uniqueTextCount} unique texts, ` +
    `${report.duplicateTextGroupCount} non-consecutive duplicate groups, ` +
    `${report.consecutiveDuplicateCount} consecutive duplicates.`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
