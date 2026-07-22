"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { trackPageDebounced } from "@/hooks/useReadingHistory";
import { useRecitationContext } from "@/components/recitation/RecitationContext";
import { pageToJuz } from "@/lib/navigation/maps";
import {
  getVisibleReaderPosition,
  resolvePageContext,
  resolveScopeStartPage,
  type ReaderScopeType,
} from "@/lib/readerPosition";

export interface ReaderNavSelection {
  page: number | null;
  verseKey: string | null;
}

interface UseReaderPositionOptions {
  type: ReaderScopeType;
  id: number;
  /** Scroll root whose visible page/verse drive the focus state (scroll modes only). */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Verse key to fall back to for nav selection (e.g. the `?verse=` param). */
  fallbackVerseKey?: string | null;
  /** When true, record the focused page in reading history (verse-by-verse mode). */
  trackHistory?: boolean;
}

/**
 * Shared reader-position state: which page the reader is "on" (for the bottom
 * nav label, the navigation picker, and the recitation player defaults) and
 * how that position is derived from the scroll container.
 */
export function useReaderPosition({
  type,
  id,
  scrollContainerRef,
  fallbackVerseKey = null,
  trackHistory = false,
}: UseReaderPositionOptions) {
  const chapters = useChapters();
  const { setContext } = useRecitationContext();

  const initialFocusPage = type === "p" ? id : null;
  const [focusPage, setFocusPage] = useState<number | null>(initialFocusPage);
  const [focusVerseKey, setFocusVerseKey] = useState<string | null>(null);

  // Reset focusPage when navigating to a different scope so the recitation
  // context (and any other labelPage consumers) immediately reflect the new
  // view instead of holding the previously scrolled page.
  const currentScopeKey = `${type}:${id}`;
  const [lastScopeKey, setLastScopeKey] = useState(currentScopeKey);
  if (lastScopeKey !== currentScopeKey) {
    setLastScopeKey(currentScopeKey);
    setFocusPage(type === "p" ? id : null);
    setFocusVerseKey(null);
  }

  const labelPage = useMemo(
    () => focusPage ?? resolveScopeStartPage(type, id, chapters),
    [chapters, focusPage, id, type],
  );

  const pageContext = useMemo(
    () =>
      chapters.length && labelPage !== null
        ? resolvePageContext(labelPage, chapters)
        : null,
    [chapters, labelPage],
  );

  const label = pageContext?.surahName ?? String(id);
  const currentSurahId = pageContext?.surahId;
  const currentJuzId = useMemo(
    () => (labelPage === null ? undefined : pageToJuz(labelPage)),
    [labelPage],
  );

  // Keep the recitation player in sync with the current view so the range
  // picker has sensible defaults when the player sheet opens.
  useLayoutEffect(() => {
    setContext({
      currentPage: labelPage ?? undefined,
      currentSurahId,
      currentJuzId,
    });
  }, [labelPage, currentSurahId, currentJuzId, setContext]);

  // Track reading on mount — derive the actual first page for s/j types.
  const lastTrackedPageRef = useRef<number | null>(null);
  useMountEffect(() => {
    if (!trackHistory) return;
    const page = resolveScopeStartPage(type, id, chapters);
    if (page !== null) {
      lastTrackedPageRef.current = page;
      trackPageDebounced(page);
    }
  });

  const handleScrollPosition = useCallback(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;
    const { page, verseKey } = getVisibleReaderPosition(
      container,
      type === "p" ? id : null,
    );
    setFocusPage(page);
    setFocusVerseKey(verseKey);
    if (
      trackHistory &&
      page !== null &&
      page !== lastTrackedPageRef.current
    ) {
      lastTrackedPageRef.current = page;
      trackPageDebounced(page);
    }
  }, [scrollContainerRef, type, id, trackHistory]);

  const getNavSelection = useCallback((): ReaderNavSelection => {
    const container = scrollContainerRef?.current;
    if (!container) {
      return { page: labelPage, verseKey: fallbackVerseKey ?? focusVerseKey };
    }
    const visible = getVisibleReaderPosition(container, labelPage);
    return {
      page: visible.page,
      verseKey: visible.verseKey ?? fallbackVerseKey ?? focusVerseKey,
    };
  }, [scrollContainerRef, labelPage, fallbackVerseKey, focusVerseKey]);

  return {
    focusPage,
    focusVerseKey,
    labelPage,
    label,
    currentSurahId,
    currentJuzId,
    getNavSelection,
    handleScrollPosition,
  };
}
