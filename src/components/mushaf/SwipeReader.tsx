"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { MushafCode, Chapter } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { useMushafPage } from "@/hooks/useMushafPage";
import { useChapters } from "@/hooks/useChapters";
import MushafPage from "@/components/mushaf/MushafPage";
import { PageSkeleton } from "@/components/mushaf/PageSkeleton";
import type { OnWordTap } from "@/lib/wordTap";

interface SwipeReaderProps {
  currentPage: number;
  mushafCode: MushafCode;
  onPageChange: (page: number) => void;
  onWordTap: OnWordTap;
  highlightedVerse?: string | null;
  onInteractionStart?: () => void;
}

// Commit spec (modern mobile UX):
//   commit if drag distance ≥ max(28px, 16% of width)
//         OR flick velocity ≥ 0.35 px/ms over ≥ 12px
//   velocity is measured over the final ~60ms of the gesture.
const COMMIT_RATIO = 0.16;
const COMMIT_MIN_PX = 28;
const FLICK_MIN_PX = 12;
const FLICK_MIN_VELOCITY = 0.35;
const TRANSITION_MS = 140;
const VELOCITY_WINDOW_MS = 60;
const TRANSITION_EASING = "cubic-bezier(0.22, 0.8, 0.3, 1)";

// ---------------------------------------------------------------------------
// PageSlot — one of three rendered pages (prev, current, next)
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
  onWordTap: OnWordTap;
  highlightedVerse?: string | null;
  chapters?: Chapter[];
}) {
  const { pageData, loading, fontReady, showFontSkeleton } = useMushafPage(mushafCode, pageNumber);
  const nextPage = pageNumber < TOTAL_PAGES ? pageNumber + 1 : pageNumber;
  const { pageData: nextPageData } = useMushafPage(mushafCode, nextPage);

  if (pageNumber < 1 || pageNumber > TOTAL_PAGES) {
    return <div className="swipe-page empty" />;
  }
  if (loading || !pageData) {
    return <div className="swipe-page"><PageSkeleton /></div>;
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
// SwipeReader engine
//
// State machine (single writer; only touch handlers + settle callback mutate):
//
//   IDLE ──(touchstart, primary)──> DRAGGING
//    ↑                                   │
//    │                                   ├──(touchend, vertical)──> IDLE
//    │                                   └──(touchend, horizontal)──> SETTLING
//    │                                                                    │
//    │ ┌──(touchstart: interrupt + inherit transform as new drag)── DRAGGING
//    │ │
//    └─┴──(transitionend or timeout fallback)──> IDLE
//
// Invariants:
//  1. `stateRef` is only mutated inside touch handlers or the settle callback.
//  2. On every IDLE entry the track transform is snapped to the middle slot.
//  3. A touch arriving during SETTLING CANCELS the transition and inherits
//     the current transform as the new drag origin (no lost input).
//  4. Commit semantics: distance OR flick velocity; velocity over last 60ms.
// ---------------------------------------------------------------------------
export default function SwipeReader({
  currentPage,
  mushafCode,
  onPageChange,
  onWordTap,
  highlightedVerse,
  onInteractionStart,
}: SwipeReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const chapters = useChapters();

  // --- engine refs ---
  const stateRef = useRef<"IDLE" | "DRAGGING" | "SETTLING">("IDLE");
  const touchIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0); // track offset (px) at drag start; normally W, but mid-interrupt it's whatever the transition had reached
  const lastXRef = useRef(0);
  const widthRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef(0);
  const horizontalDecidedRef = useRef<"unknown" | "yes" | "no">("unknown");
  const samplesRef = useRef<{ x: number; t: number }[]>([]);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleHandlerRef = useRef<(() => void) | null>(null);

  // --- props mirrored to refs (updated during render; no effect needed) ---
  const onPageChangeRef = useRef(onPageChange);
  const onInteractionStartRef = useRef(onInteractionStart);
  const currentPageRef = useRef(currentPage);
  onPageChangeRef.current = onPageChange;
  onInteractionStartRef.current = onInteractionStart;
  currentPageRef.current = currentPage;

  const renderedPages = [currentPage - 1, currentPage, currentPage + 1];

  // ---------- helpers ----------
  function anchorMiddleSync() {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    clearSettle();
    const W = container.clientWidth;
    widthRef.current = W;
    track.style.transition = "none";
    track.style.transform = `translate3d(${W}px, 0, 0)`;
    stateRef.current = "IDLE";
  }

  function readTrackOffset(): number {
    const track = trackRef.current;
    if (!track) return widthRef.current;
    const m = getComputedStyle(track).transform.match(/matrix\(1, 0, 0, 1, (-?[\d.]+),/);
    return m ? Number(m[1]) : widthRef.current;
  }

  function clearSettle() {
    if (settleTimeoutRef.current !== null) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    const track = trackRef.current;
    const h = settleHandlerRef.current;
    if (track && h) track.removeEventListener("transitionend", h);
    settleHandlerRef.current = null;
  }

  function commitExternal(target: number) {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, target));
    if (clamped !== currentPageRef.current) onPageChangeRef.current(clamped);
  }

  // --- resize + keyboard + wheel (mount-only DOM listeners) ---
  useEffect(() => {
    const onResize = () => {
      if (stateRef.current === "IDLE") anchorMiddleSync();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onInteractionStartRef.current?.();
        commitExternal(currentPageRef.current + 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onInteractionStartRef.current?.();
        commitExternal(currentPageRef.current - 1);
      }
    };
    let wheelLock = false;
    const onWheel = (e: WheelEvent) => {
      if (wheelLock || Math.abs(e.deltaY) <= 20) return;
      onInteractionStartRef.current?.();
      commitExternal(currentPageRef.current + (e.deltaY > 0 ? 1 : -1));
      wheelLock = true;
      setTimeout(() => { wheelLock = false; }, 220);
    };
    const container = containerRef.current;
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    container?.addEventListener("wheel", onWheel, { passive: true });
    // Set initial anchor on mount.
    anchorMiddleSync();
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
      container?.removeEventListener("wheel", onWheel);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      clearSettle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- touch handlers ----------
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const newTouch = e.changedTouches[e.changedTouches.length - 1] ?? e.touches[e.touches.length - 1];
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    const W = container.clientWidth;
    widthRef.current = W;

    if (stateRef.current === "SETTLING") {
      // Interrupt: freeze the track at its current visual offset and treat
      // this touch as the start of a new drag inheriting that displacement.
      clearSettle();
      const currentOffset = readTrackOffset();
      track.style.transition = "none";
      track.style.transform = `translate3d(${currentOffset}px, 0, 0)`;
      startOffsetRef.current = currentOffset;
      startXRef.current = newTouch.clientX;
      startYRef.current = newTouch.clientY;
      horizontalDecidedRef.current = "yes"; // already past decision — we're mid-swipe
      samplesRef.current = [{ x: newTouch.clientX, t: performance.now() }];
      stateRef.current = "DRAGGING";
    } else if (stateRef.current === "DRAGGING" && touchIdRef.current !== null) {
      // Multi-touch finger handoff: preserve running displacement.
      const runningDeltaX = lastXRef.current - startXRef.current;
      startXRef.current = newTouch.clientX - runningDeltaX;
    } else {
      // Fresh gesture from IDLE.
      track.style.transition = "none";
      startOffsetRef.current = W;
      startXRef.current = newTouch.clientX;
      startYRef.current = newTouch.clientY;
      horizontalDecidedRef.current = "unknown";
      samplesRef.current = [{ x: newTouch.clientX, t: performance.now() }];
      stateRef.current = "DRAGGING";
    }

    touchIdRef.current = newTouch.identifier;
    lastXRef.current = newTouch.clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (stateRef.current !== "DRAGGING" || touchIdRef.current === null) return;
    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) { touch = e.touches[i]; break; }
    }
    if (!touch) return;

    const x = touch.clientX;
    const y = touch.clientY;
    let deltaX = x - startXRef.current;
    lastXRef.current = x;

    const now = performance.now();
    const samples = samplesRef.current;
    samples.push({ x, t: now });
    const cutoff = now - VELOCITY_WINDOW_MS * 3;
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift();

    if (horizontalDecidedRef.current === "unknown") {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(y - startYRef.current);
      if (absX > 5 || absY > 5) {
        if (absX > absY * 1.3) {
          horizontalDecidedRef.current = "yes";
          onInteractionStartRef.current?.();
        } else {
          horizontalDecidedRef.current = "no";
          stateRef.current = "IDLE";
          touchIdRef.current = null;
          return;
        }
      }
    }
    if (horizontalDecidedRef.current !== "yes") return;

    // Rubber-band at boundaries: attenuate overshoot in the direction with no page.
    const page = currentPageRef.current;
    const projectedOffset = startOffsetRef.current + deltaX;
    const W = widthRef.current;
    let targetOffset = projectedOffset;
    if (page === 1 && projectedOffset > W) {
      // dragging right past the middle slot but no page 0 → rubber-band
      targetOffset = W + (projectedOffset - W) * 0.3;
    } else if (page === TOTAL_PAGES && projectedOffset < W) {
      targetOffset = W + (projectedOffset - W) * 0.3;
    }

    pendingOffsetRef.current = targetOffset;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${pendingOffsetRef.current}px, 0, 0)`;
        }
      });
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (stateRef.current !== "DRAGGING") return;
    let trackingFingerLifted = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        trackingFingerLifted = true;
        break;
      }
    }
    if (!trackingFingerLifted) return;

    if (horizontalDecidedRef.current !== "yes") {
      stateRef.current = "IDLE";
      touchIdRef.current = null;
      return;
    }

    // Cancel any pending RAF so our touchend-driven transition isn't overwritten.
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const W = widthRef.current;
    const deltaX = lastXRef.current - startXRef.current;
    const absDeltaX = Math.abs(deltaX);

    // Velocity over the final ~60ms of movement.
    let velocity = 0;
    const samples = samplesRef.current;
    if (samples.length >= 2) {
      const end = samples[samples.length - 1];
      let windowStart = samples[0];
      for (let i = samples.length - 2; i >= 0; i--) {
        windowStart = samples[i];
        if (samples[i].t <= end.t - VELOCITY_WINDOW_MS) break;
      }
      const dt = end.t - windowStart.t;
      if (dt > 0) velocity = (end.x - windowStart.x) / dt;
    }
    const absVelocity = Math.abs(velocity);

    const distanceThreshold = Math.max(COMMIT_MIN_PX, W * COMMIT_RATIO);
    const shouldCommit =
      absDeltaX >= distanceThreshold ||
      (absDeltaX >= FLICK_MIN_PX && absVelocity >= FLICK_MIN_VELOCITY);

    const page = currentPageRef.current;
    let targetPage = page;
    let targetOffset = W;
    if (shouldCommit) {
      if (deltaX < 0 && page > 1) {
        targetPage = page - 1;
        targetOffset = 0;
      } else if (deltaX > 0 && page < TOTAL_PAGES) {
        targetPage = page + 1;
        targetOffset = 2 * W;
      }
    }

    touchIdRef.current = null;
    stateRef.current = "SETTLING";

    const track = trackRef.current;
    if (!track) {
      stateRef.current = "IDLE";
      return;
    }
    track.style.transition = `transform ${TRANSITION_MS}ms ${TRANSITION_EASING}`;
    track.style.transform = `translate3d(${targetOffset}px, 0, 0)`;

    const onDone = () => {
      if (stateRef.current !== "SETTLING") return; // already interrupted
      clearSettle();
      stateRef.current = "IDLE";
      // Snap the track back to the middle slot BEFORE committing the page
      // change, then flushSync the commit so React paints the new
      // renderedPages in the SAME frame as the snap. transitionend is not a
      // React event so React's automatic batching does not apply — without
      // flushSync, the browser can paint between the snap (transform=W,
      // showing the OLD middle page) and React committing the new
      // renderedPages array, producing a visible x → x+1 → x → x+1 flicker.
      track.style.transition = "none";
      track.style.transform = `translate3d(${W}px, 0, 0)`;
      if (targetPage !== currentPageRef.current) {
        flushSync(() => onPageChangeRef.current(targetPage));
      }
    };
    settleHandlerRef.current = onDone;
    track.addEventListener("transitionend", onDone);
    settleTimeoutRef.current = setTimeout(onDone, TRANSITION_MS + 40);
  }, []);

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
