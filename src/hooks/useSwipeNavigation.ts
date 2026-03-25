"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";

/**
 * Handles keyboard arrows (RTL-aware) and touch swipe gestures
 * for page-level navigation.
 *
 * In RTL context: ArrowLeft = next page, ArrowRight = prev page.
 */
export function useSwipeNavigation(
  containerRef: RefObject<HTMLElement | null>,
  onPageChange: (direction: "next" | "prev") => void,
): void {
  const onPageChangeRef = useRef(onPageChange);

  useLayoutEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  // ---- Touch swipe ----
  useMountEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const SWIPE_THRESHOLD = 50;
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      // RTL: swiping left (negative deltaX) = prev, swiping right (positive) = next
      if (deltaX > 0) {
        onPageChangeRef.current("next");
      } else {
        onPageChangeRef.current("prev");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  });

  // ---- Keyboard listener ----
  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPageChangeRef.current("next");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onPageChangeRef.current("prev");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });
}
