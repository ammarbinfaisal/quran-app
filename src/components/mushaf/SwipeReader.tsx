"use client";

import { useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type { MushafCode, Chapter } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { useMushafPage } from "@/hooks/useMushafPage";
import { useChapters } from "@/hooks/useChapters";
import MushafPage from "@/components/mushaf/MushafPage";
import { PageSkeleton } from "@/components/mushaf/PageSkeleton";

interface SwipeReaderProps {
  currentPage: number;
  mushafCode: MushafCode;
  onPageChange: (page: number) => void;
  onWordTap: (verseKey: string, wordIndex: number) => void;
  highlightedVerse?: string | null;
}

// ---------------------------------------------------------------------------
// Single Page Slot
// ---------------------------------------------------------------------------
function PageSlot({
  pageNumber,
  mushafCode,
  onWordTap,
  highlightedVerse,
  chapters,
}: {
  pageNumber: number;
  mushafCode: MushafCode;
  onWordTap: (verseKey: string, wordIndex: number) => void;
  highlightedVerse?: string | null;
  chapters?: Chapter[];
}) {
  const { pageData, loading, fontReady, showFontSkeleton } = useMushafPage(mushafCode, pageNumber);
  const nextPage = pageNumber < TOTAL_PAGES ? pageNumber + 1 : pageNumber;
  const { pageData: nextPageData } = useMushafPage(mushafCode, nextPage);

  if (pageNumber < 1 || pageNumber > TOTAL_PAGES) {
    return <div className="swipe-page empty" />;
  }

  // Still show full PageSkeleton if we don't have the basic data (JSON) yet
  if (loading || !pageData) {
    return (
      <div className="swipe-page">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="swipe-page">
      <MushafPage
        pageData={pageData}
        mushafCode={mushafCode}
        onWordTap={onWordTap}
        highlightedVerse={highlightedVerse}
        chapters={chapters}
        fontReady={fontReady}
        showFontSkeleton={showFontSkeleton}
        nextPageData={nextPageData}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Swipe Reader Engine
// ---------------------------------------------------------------------------
export default function SwipeReader({
  currentPage,
  mushafCode,
  onPageChange,
  onWordTap,
  highlightedVerse,
}: SwipeReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chapters = useChapters();

  const isTouchActiveRef = useRef(false);
  const ignoreScrollRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const commitLockRef = useRef<number | null>(null);
  const widthRef = useRef(0);

  // Keep callback fresh without triggering renders
  const onPageChangeRef = useRef(onPageChange);
  useLayoutEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  // Track the pages we're currently rendering directly during component render
  // Order matters: we want a RIGHT swipe (finger L→R) to go forward (page+1).
  // In an LTR scroll container, dragging right reveals content on the left, so we
  // place the "next" page on the left slot.
  const renderedPages = [currentPage + 1, currentPage, currentPage - 1];

  const centerOnCurrent = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    if (!W) return;
    widthRef.current = W;
    ignoreScrollRef.current = true;
    container.scrollTo({ left: W, behavior });
    if (behavior === "smooth") {
      window.setTimeout(() => {
        ignoreScrollRef.current = false;
      }, 350);
    } else {
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
      });
    }
  }, []);

  // Synchronous recenter to keep the "current" page in the middle slot without visible jump.
  useLayoutEffect(() => {
    commitLockRef.current = null;
    centerOnCurrent("auto");
  }, [currentPage, centerOnCurrent]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      centerOnCurrent("auto");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [centerOnCurrent]);

  // Keyboard navigation & Mouse Wheel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentPage < TOTAL_PAGES) onPageChangeRef.current(currentPage + 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentPage > 1) onPageChangeRef.current(currentPage - 1);
      }
    };

    const container = containerRef.current;
    let wheelLock = false;

    const handleWheel = (e: WheelEvent) => {
      if (wheelLock) return;
      if (Math.abs(e.deltaY) > 20) {
        if (e.deltaY > 0) {
          if (currentPage < TOTAL_PAGES) {
            onPageChangeRef.current(currentPage + 1);
            wheelLock = true;
            setTimeout(() => { wheelLock = false; }, 500);
          }
        } else {
          if (currentPage > 1) {
            onPageChangeRef.current(currentPage - 1);
            wheelLock = true;
            setTimeout(() => { wheelLock = false; }, 500);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: true });
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, [currentPage]);

  const settleFromScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (ignoreScrollRef.current) return;
      if (isTouchActiveRef.current) return;

      const W = container.clientWidth || widthRef.current;
      if (!W) return;
      widthRef.current = W;

      const rawIndex = Math.round(container.scrollLeft / W);
      const slotIndex = Math.max(0, Math.min(2, rawIndex));

      if (slotIndex === 1) return;
      if (commitLockRef.current === currentPage) return;

      const targetPage = slotIndex === 0 ? currentPage + 1 : currentPage - 1;
      if (targetPage < 1 || targetPage > TOTAL_PAGES) {
        centerOnCurrent("smooth");
        return;
      }

      commitLockRef.current = currentPage;
      onPageChangeRef.current(targetPage);
    }, 120);
  }, [centerOnCurrent, currentPage]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  const handleScroll = useCallback(() => {
    settleFromScroll();
  }, [settleFromScroll]);

  const handleTouchStart = useCallback(() => {
    isTouchActiveRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isTouchActiveRef.current = false;
    settleFromScroll();
  }, [settleFromScroll]);

  return (
    <div
      ref={containerRef}
      className="swipe-container"
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="swipe-track">
        {renderedPages.map((pageNum) => (
          <PageSlot
            key={pageNum}
            pageNumber={pageNum}
            mushafCode={mushafCode}
            onWordTap={onWordTap}
            highlightedVerse={highlightedVerse}
            chapters={chapters}
          />
        ))}
      </div>
    </div>
  );
}
