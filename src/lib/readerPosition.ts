import type { Chapter } from "@/lib/types";
import { JUZ_PAGE_RANGES, type JuzPageRange } from "@/lib/juz";
import { pageToSurah, pageToJuz } from "@/lib/navigation/maps";
import {
  getFirstFullyVisiblePage,
  getFirstFullyVisibleVerse,
} from "@/lib/viewport";

export type ReaderScopeType = "p" | "s" | "j";

/**
 * Resolves the first mushaf page of a reader scope (page / surah / juz).
 * Returns null when the scope cannot be resolved (e.g. chapters not loaded).
 */
export function resolveScopeStartPage(
  type: ReaderScopeType,
  id: number,
  chapters: Chapter[],
  juzRanges: readonly JuzPageRange[] = JUZ_PAGE_RANGES,
): number | null {
  if (type === "p") return id;
  if (type === "s") {
    return chapters.find((chapter) => chapter.id === id)?.pages[0] ?? null;
  }
  return juzRanges.find((range) => range.juz === id)?.pages[0] ?? null;
}

export interface ReaderPageContext {
  page: number;
  surahId: number;
  juzId: number;
  surahName: string;
}

/**
 * Derives the surah/juz context for a mushaf page.
 */
export function resolvePageContext(
  page: number,
  chapters: Chapter[],
): ReaderPageContext {
  const surahId = pageToSurah(page, chapters);
  const juzId = pageToJuz(page);
  const surahName =
    chapters.find((chapter) => chapter.id === surahId)?.nameSimple ??
    String(page);
  return { page, surahId, juzId, surahName };
}

export interface VisibleReaderPosition {
  page: number | null;
  verseKey: string | null;
}

/**
 * Returns the first fully visible page and verse within a scroll container,
 * falling back to the given page when no page marker is visible.
 */
export function getVisibleReaderPosition(
  scrollContainer: HTMLElement,
  fallbackPage: number | null,
): VisibleReaderPosition {
  return {
    page: getFirstFullyVisiblePage(scrollContainer) ?? fallbackPage,
    verseKey: getFirstFullyVisibleVerse(scrollContainer),
  };
}
