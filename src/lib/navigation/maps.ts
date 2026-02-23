import type { MushafCode, Chapter } from "@/lib/types";
import { type JuzPageRange, JUZ_PAGE_RANGES } from "@/lib/juz";

export type VersePageLookup = number | [startPage: number, endPage: number];
export type VersePageMap = Record<string, VersePageLookup>;
export type SurahPageRange = { surah: number; pages: [startPage: number, endPage: number] };

const versePagesCache: Partial<Record<MushafCode, Promise<VersePageMap>>> = {};
const surahPagesCache: Partial<Record<MushafCode, Promise<SurahPageRange[]>>> = {};
let juzPagesCache: Promise<readonly JuzPageRange[]> | null = null;

export function fetchVersePages(mushafCode: MushafCode): Promise<VersePageMap> {
  versePagesCache[mushafCode] ??= fetch(`/data/verse-pages.${mushafCode}.json`).then(
    async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to load verse-pages.${mushafCode}.json: ${res.status}`,
        );
      }
      return res.json() as Promise<VersePageMap>;
    },
  );
  return versePagesCache[mushafCode]!;
}

export function fetchSurahPages(mushafCode: MushafCode): Promise<SurahPageRange[]> {
  surahPagesCache[mushafCode] ??= fetch(`/data/surah-pages.${mushafCode}.json`).then(
    async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to load surah-pages.${mushafCode}.json: ${res.status}`,
        );
      }
      return res.json() as Promise<SurahPageRange[]>;
    },
  );
  return surahPagesCache[mushafCode]!;
}

export function fetchJuzPages(): Promise<readonly JuzPageRange[]> {
  juzPagesCache ??= fetch("/data/juz-pages.madani.json").then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to load juz-pages.madani.json: ${res.status}`);
    }
    return res.json() as Promise<readonly JuzPageRange[]>;
  });
  return juzPagesCache;
}

/**
 * Returns juz page ranges for the given mushaf.
 */
export function fetchJuzPagesForMushaf(): Promise<readonly JuzPageRange[]> {
  return fetchJuzPages();
}

/**
 * Returns the first verseKey whose page equals the target page.
 * The verse-pages map is ordered by verse insertion (i.e. Quran order),
 * so the first match is the first verse on that page.
 */
export async function pageToFirstVerse(
  page: number,
  mushafCode: MushafCode,
): Promise<string | null> {
  const versePages = await fetchVersePages(mushafCode);
  for (const [vk, lookup] of Object.entries(versePages)) {
    const p = typeof lookup === "number" ? lookup : lookup[0];
    if (p === page) return vk;
  }
  return null;
}

/**
 * Maps a page number to the surah it belongs to.
 */
export function pageToSurah(page: number, chapters: Chapter[]): number {
  const ch = chapters.find((c) => c.pages[0] <= page && page <= c.pages[1]);
  return ch ? ch.id : 1;
}

/**
 * Maps a page number to the juz it belongs to.
 */
export function pageToJuz(page: number): number {
  const j = JUZ_PAGE_RANGES.find((j) => j.pages[0] <= page && page <= j.pages[1]);
  return j ? j.juz : 1;
}
