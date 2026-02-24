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
  const trackRef = useRef<HTMLDivElement>(null);
  const chapters = useChapters();

  // State Machine Refs
  const stateRef = useRef<"IDLE" | "DRAGGING" | "ANIMATING">("IDLE");
  const touchIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isSwipeDecisionMadeRef = useRef(false);
  const isHorizontalSwipeRef = useRef(false);
  const widthRef = useRef(0);

  // Keep callback fresh without triggering renders
  const onPageChangeRef = useRef(onPageChange);
  useLayoutEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  // Track the pages we're currently rendering directly during component render
  const renderedPages = [currentPage - 1, currentPage, currentPage + 1];

  // Synchronous React mounting to prevent any flicker
  useLayoutEffect(() => {
    if (containerRef.current && trackRef.current) {
      const W = containerRef.current.clientWidth;
      widthRef.current = W;

      // In RTL flex, Item 0 is offset 0, Item 1 is -W, Item 2 is -2W
      // So pushing track right by `+W` perfectly centers Item 1
      trackRef.current.style.transition = "none";
      trackRef.current.style.transform = `translate3d(${W}px, 0, 0)`;
      stateRef.current = "IDLE";
    }
  }, [currentPage]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && trackRef.current && stateRef.current === "IDLE") {
        const W = containerRef.current.clientWidth;
        widthRef.current = W;
        trackRef.current.style.transition = "none";
        trackRef.current.style.transform = `translate3d(${W}px, 0, 0)`;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // ---------------------------------------------------------------------------
  // Touch Handlers
  // ---------------------------------------------------------------------------
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Once the finger lifts, the swipe intent is committed. Ignore new touches
    // during the in-flight transition (user can swipe back right after).
    if (stateRef.current === "ANIMATING") return;
    if (e.touches.length === 0) return;

    // Follow the *newest* touch that was just added to the screen
    const newTouch = e.changedTouches[e.changedTouches.length - 1] || e.touches[e.touches.length - 1];

    if (stateRef.current === "DRAGGING" && touchIdRef.current !== null) {
      // Handoff to the new finger without jumping the track.
      // We calculate how much we've already naturally moved...
      const currentDeltaX = lastXRef.current - startXRef.current;
      const currentDeltaY = lastYRef.current - startYRef.current;

      // ...and anchor the new finger so the math maintains the current displacement perfectly.
      startXRef.current = newTouch.clientX - currentDeltaX;
      startYRef.current = newTouch.clientY - currentDeltaY;
    } else {
      // First finger down
      startXRef.current = newTouch.clientX;
      startYRef.current = newTouch.clientY;
      startTimeRef.current = Date.now();
      isSwipeDecisionMadeRef.current = false;
      isHorizontalSwipeRef.current = false;

      if (containerRef.current) {
        widthRef.current = containerRef.current.clientWidth;
      }
      stateRef.current = "DRAGGING";
      if (trackRef.current) {
        trackRef.current.style.transition = "none";
      }
    }

    touchIdRef.current = newTouch.identifier;
    lastXRef.current = newTouch.clientX;
    lastYRef.current = newTouch.clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (stateRef.current !== "DRAGGING") return;
    if (touchIdRef.current === null) return;

    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const currentX = touch.clientX;
    const currentY = touch.clientY;
    let deltaX = currentX - startXRef.current;

    lastXRef.current = currentX;
    lastYRef.current = currentY;

    if (!isSwipeDecisionMadeRef.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(currentY - startYRef.current);

      if (absX > 5 || absY > 5) {
        isSwipeDecisionMadeRef.current = true;
        if (absX > absY * 1.5) {
          isHorizontalSwipeRef.current = true;
        } else {
          // Vertical scroll detected, cancel our swipe
          stateRef.current = "IDLE";
          touchIdRef.current = null;
          return;
        }
      }
    }

    if (isHorizontalSwipeRef.current) {
      const W = widthRef.current;

      // Rubber banding at edges
      if (currentPage === TOTAL_PAGES && deltaX > 0) {
        deltaX = deltaX * 0.3;
      } else if (currentPage === 1 && deltaX < 0) {
        deltaX = deltaX * 0.3;
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${W + deltaX}px, 0, 0)`;
      }
    }
  }, [currentPage]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (stateRef.current !== "DRAGGING") return;

    // Check if the removed finger was the one we were tracking
    let trackingFingerLifted = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        trackingFingerLifted = true;
        break;
      }
    }

    if (!trackingFingerLifted) {
      // Some other finger lifted, keep dragging with our tracked finger
      return;
    }

    // If it was just a tap or vertical scroll
    if (!isHorizontalSwipeRef.current) {
      stateRef.current = "IDLE";
      touchIdRef.current = null;
      return;
    }

    // Process the swipe finish
    stateRef.current = "ANIMATING";
    const W = widthRef.current;

    const deltaX = lastXRef.current - startXRef.current;
    const timeDelta = Date.now() - startTimeRef.current;
    const velocity = timeDelta > 0 ? deltaX / timeDelta : 0;

    const threshold = W / 3;
    let targetPage = currentPage;
    let targetOffset = W;

    // Drag left -> Go to Page-1 (Offset: 0)
    if ((deltaX < -threshold || velocity < -0.5) && currentPage > 1) {
      targetPage = currentPage - 1;
      targetOffset = 0;
    }
    // Drag right -> Go to Page+1 (Offset: 2W)
    else if ((deltaX > threshold || velocity > 0.5) && currentPage < TOTAL_PAGES) {
      targetPage = currentPage + 1;
      targetOffset = 2 * W;
    }

    if (trackRef.current) {
      trackRef.current.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1)";
      trackRef.current.style.transform = `translate3d(${targetOffset}px, 0, 0)`;

      // If we snapped back to the same page, reset IDLE here.
      // If we changed page, the `useLayoutEffect` on `currentPage` change will reset IDLE.
      let done = false;
      const transitionCb = () => {
        if (done) return;
        done = true;
        if (targetPage !== currentPage) {
          onPageChangeRef.current(targetPage);
        } else {
          stateRef.current = "IDLE";
        }
        if (trackRef.current) {
          trackRef.current.removeEventListener("transitionend", transitionCb);
        }
      };

      trackRef.current.addEventListener("transitionend", transitionCb);
      setTimeout(() => {
        if (stateRef.current === "ANIMATING") transitionCb();
      }, 260);
    }

    touchIdRef.current = null;
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="swipe-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div ref={trackRef} className="swipe-track">
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
