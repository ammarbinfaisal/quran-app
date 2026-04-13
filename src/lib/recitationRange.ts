import type { Chapter } from "@/lib/types";
import { JUZ_VERSE_RANGES } from "@/lib/juz";

export interface VerseRef {
  surah: number;
  ayah: number;
}

export function parseVerseKey(verseKey: string): VerseRef | null {
  const [surahStr, ayahStr] = verseKey.split(":");
  const surah = Number.parseInt(surahStr, 10);
  const ayah = Number.parseInt(ayahStr, 10);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
  return { surah, ayah };
}

export function compareVerseKeys(a: string, b: string): number {
  const left = parseVerseKey(a);
  const right = parseVerseKey(b);
  if (!left || !right) return 0;
  if (left.surah !== right.surah) return left.surah - right.surah;
  return left.ayah - right.ayah;
}

export function isVerseInRange(verseKey: string, start: string, end: string): boolean {
  return compareVerseKeys(verseKey, start) >= 0 && compareVerseKeys(verseKey, end) <= 0;
}

export function clampAyah(surahId: number, ayah: number, chapters: Chapter[]): number {
  const chapter = chapters.find((c) => c.id === surahId);
  if (!chapter) return Math.max(1, ayah);
  return Math.max(1, Math.min(chapter.versesCount, ayah));
}

export function buildVerseList(
  startVerse: string,
  endVerse: string,
  chapters: Chapter[],
): string[] {
  const start = parseVerseKey(startVerse);
  const end = parseVerseKey(endVerse);
  if (!start || !end) return [];

  const verses: string[] = [];
  for (let s = start.surah; s <= end.surah; s++) {
    const chapter = chapters.find((c) => c.id === s);
    if (!chapter) continue;
    const fromAyah = s === start.surah ? start.ayah : 1;
    const toAyah = s === end.surah ? end.ayah : chapter.versesCount;
    for (let a = fromAyah; a <= toAyah; a++) {
      verses.push(`${s}:${a}`);
    }
  }
  return verses;
}

export interface RangeBounds {
  startVerse: string;
  endVerse: string;
}

export function juzBounds(juz: number): RangeBounds | null {
  const entry = JUZ_VERSE_RANGES.find((j) => j.juz === juz);
  return entry ? { startVerse: entry.startVerse, endVerse: entry.endVerse } : null;
}

export function surahBounds(surahId: number, chapters: Chapter[]): RangeBounds | null {
  const chapter = chapters.find((c) => c.id === surahId);
  if (!chapter) return null;
  return {
    startVerse: `${surahId}:1`,
    endVerse: `${surahId}:${chapter.versesCount}`,
  };
}
