"use client";

import { useEffect, useRef } from "react";
import { useRecitationPlayer } from "@/components/recitation/useRecitationPlayer";
import { fetchVersePages } from "@/lib/navigation/maps";
import type { MushafCode } from "@/lib/types";

/**
 * Follow-the-recitation for the page-by-page mushaf reader: when sync is
 * enabled and playback is active, turn to the mushaf page that contains the
 * currently recited verse. Navigation goes through the reader's own
 * handlePageChange (state + debounced history.replaceState), never the
 * router, so swipes and auto-follows behave identically.
 */
export function useRecitationAutoFollowPage({
  mushafCode,
  currentPage,
  onPageChange,
}: {
  mushafCode: MushafCode;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const { currentVerse, status, syncWithRecitation } = useRecitationPlayer();

  // Guards against re-following (and yanking the user back) for a verse we
  // already handled — e.g. when the user swipes away mid-verse.
  const lastFollowedVerseRef = useRef<string | null>(null);
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  });

  useEffect(() => {
    if (status === "idle") {
      lastFollowedVerseRef.current = null;
      return;
    }
    if (!syncWithRecitation || !currentVerse) return;
    if (lastFollowedVerseRef.current === currentVerse) return;
    lastFollowedVerseRef.current = currentVerse;

    let active = true;
    fetchVersePages(mushafCode)
      .then((versePages) => {
        if (!active) return;
        const lookup = versePages[currentVerse];
        if (!lookup) return;
        const targetPage = typeof lookup === "number" ? lookup : lookup[0];
        if (targetPage !== currentPageRef.current) {
          onPageChange(targetPage);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentVerse, status, syncWithRecitation, mushafCode, onPageChange]);
}
