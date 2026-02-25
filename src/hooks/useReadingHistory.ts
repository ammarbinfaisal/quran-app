"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getReadingHistory, updateReadingHistory } from "@/lib/history";
import { getChapters, getChaptersOnPage } from "@/lib/chapters";
import { READING_HISTORY_DEBOUNCE_MS } from "@/lib/constants";
import type { HistoryEntry, Chapter } from "@/lib/types";

export function useReadingHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window !== "undefined") return getReadingHistory();
    return [];
  });

  useEffect(() => {
    const onHistoryChanged = (e: Event) => {
      setHistory((e as CustomEvent<HistoryEntry[]>).detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "quran-reading-history") setHistory(getReadingHistory());
    };
    // Handles bfcache restores where the component instance may not remount.
    const onPageShow = () => setHistory(getReadingHistory());

    window.addEventListener("reading-history-changed", onHistoryChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("reading-history-changed", onHistoryChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<HistoryEntry[]>("reading-history-changed", {
        detail: getReadingHistory(),
      }),
    );
  }, []);

  return { history, refresh };
}

/**
 * Hook that auto-updates reading history as the user navigates pages.
 * Debounced to avoid excessive writes.
 */
export function useTrackReading(currentPage: number) {
  const chaptersRef = useRef<Chapter[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    chaptersRef.current = getChapters();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const chapters = chaptersRef.current;
      if (!chapters.length) return;

      const onPage = getChaptersOnPage(chapters, currentPage);
      for (const ch of onPage) {
        // Estimate which verse we're at based on page position within chapter
        const [startPage, endPage] = ch.pages;
        const pageSpan = Math.max(1, endPage - startPage + 1);
        const pageOffset = currentPage - startPage;
        const estimatedVerse = Math.max(
          1,
          Math.ceil((pageOffset / pageSpan) * ch.versesCount),
        );

        updateReadingHistory({
          chapterId: ch.id,
          chapterName: ch.nameSimple,
          verseKey: `${ch.id}:${estimatedVerse}`,
          pageNumber: currentPage,
          timestamp: Date.now(),
        });
      }
    }, READING_HISTORY_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentPage]);
}
