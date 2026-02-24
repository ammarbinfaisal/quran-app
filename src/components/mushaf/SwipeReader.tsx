"use client";

import { useRef, useEffect, useLayoutEffect } from "react";
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
// Swipe Reader — CSS scroll-snap engine
// ---------------------------------------------------------------------------
//
// Three LTR slots at track width 300%:
//
//   slot 0 [currentPage+1]  |  slot 1 [currentPage]  |  slot 2 [currentPage-1]
//   scrollLeft = 0          |  scrollLeft = W         |  scrollLeft = 2W
//
// Swiping RIGHT  (scrollLeft decreases → 0)  → next page  (currentPage+1)
// Swiping LEFT   (scrollLeft increases → 2W) → prev page  (currentPage-1)
//
// Peek-and-drag-back is handled entirely by the browser's snap physics —
// there are zero JS touch handlers. The browser naturally springs back to
// the nearest snap point when the finger doesn't cross the threshold.
//
export default function SwipeReader({
  currentPage,
  mushafCode,
  onPageChange,
  onWordTap,
  highlightedVerse,
}: SwipeReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chapters = useChapters();

  // Keep callback fresh without re-running effects
  const onPageChangeRef = useRef(onPageChange);
  useLayoutEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  // Guard: skip scrollend events caused by our own programmatic reset
  const isResettingRef = useRef(false);

  // LTR slot order: [next, current, prev]
  const renderedPages = [currentPage + 1, currentPage, currentPage - 1];

  // -------------------------------------------------------------------------
  // Reset scroll to center whenever currentPage changes.
  // useLayoutEffect fires synchronously before paint, so the user never sees
  // the container at the wrong position — even as the slot content updates.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    isResettingRef.current = true;
    container.scrollLeft = container.clientWidth; // instant, no animation
    // Allow the next paint frame before accepting new scrollend events
    requestAnimationFrame(() => {
      isResettingRef.current = false;
    });
  }, [currentPage]);

  // -------------------------------------------------------------------------
  // scrollend: fired by the browser after any snap animation finishes.
  // Inspect scrollLeft to decide which page the user landed on.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      if (isResettingRef.current) return;

      const W = container.clientWidth;
      const sl = container.scrollLeft;
      const tol = W * 0.3; // 30% — comfortably inside any snap threshold

      if (sl < tol) {
        // Snapped to slot 0 → next page
        if (currentPage < TOTAL_PAGES) {
          onPageChangeRef.current(currentPage + 1);
        } else {
          // Already at last page — bounce back to center
          container.scrollTo({ left: W, behavior: "smooth" });
        }
      } else if (sl > W * 2 - tol) {
        // Snapped to slot 2 → prev page
        if (currentPage > 1) {
          onPageChangeRef.current(currentPage - 1);
        } else {
          // Already at first page — bounce back to center
          container.scrollTo({ left: W, behavior: "smooth" });
        }
      }
      // Settled at center (peek-and-drag-back) → no change needed
    };

    container.addEventListener("scrollend", handleScrollEnd);

    // Fallback for browsers without scrollend (debounce on scroll)
    let fallbackTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(handleScrollEnd, 150);
    };
    const supportsScrollEnd = "onscrollend" in window;
    if (!supportsScrollEnd) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      container.removeEventListener("scrollend", handleScrollEnd);
      if (!supportsScrollEnd) {
        container.removeEventListener("scroll", handleScroll);
        clearTimeout(fallbackTimer);
      }
    };
  }, [currentPage]);

  // -------------------------------------------------------------------------
  // Keyboard navigation — bypass scroll, call onPageChange directly
  // -------------------------------------------------------------------------
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentPage]);

  // -------------------------------------------------------------------------
  // Mouse-wheel navigation
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let wheelLock = false;
    const handleWheel = (e: WheelEvent) => {
      if (wheelLock || Math.abs(e.deltaY) <= 20) return;
      if (e.deltaY > 0 && currentPage < TOTAL_PAGES) {
        onPageChangeRef.current(currentPage + 1);
        wheelLock = true;
        setTimeout(() => { wheelLock = false; }, 500);
      } else if (e.deltaY < 0 && currentPage > 1) {
        onPageChangeRef.current(currentPage - 1);
        wheelLock = true;
        setTimeout(() => { wheelLock = false; }, 500);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [currentPage]);

  return (
    <div ref={containerRef} className="swipe-container">
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
