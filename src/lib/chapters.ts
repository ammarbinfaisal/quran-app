import { fetchChapters } from "./api";
import type { Chapter } from "./types";

let cache: Chapter[] | null = null;

export async function getChapters(): Promise<Chapter[]> {
  if (cache) return cache;
  cache = await fetchChapters();
  return cache;
}

/**
 * Estimate which mushaf page contains a given verse.
 * Uses linear interpolation within the chapter's page range.
 */
export function getPageForVerse(
  chapters: Chapter[],
  surah: number,
  ayah: number,
): number {
  const ch = chapters.find((c) => c.id === surah);
  if (!ch) return 1;
  const [startPage, endPage] = ch.pages;
  if (startPage === endPage) return startPage;
  const ratio = Math.max(0, (ayah - 1)) / Math.max(1, ch.versesCount - 1);
  return Math.min(endPage, startPage + Math.floor(ratio * (endPage - startPage)));
}

/**
 * Return chapters whose page range includes the given page number.
 */
export function getChaptersOnPage(
  chapters: Chapter[],
  pageNum: number,
): Chapter[] {
  return chapters.filter(
    (c) => pageNum >= c.pages[0] && pageNum <= c.pages[1],
  );
}

/**
 * Get a single chapter by ID.
 */
export function getChapterById(
  chapters: Chapter[],
  id: number,
): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}
