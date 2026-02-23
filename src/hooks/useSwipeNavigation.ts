"use client";

import { useEffect, useCallback, type RefObject } from "react";

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
  // ---- Keyboard ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPageChange("next");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onPageChange("prev");
      }
    },
    [onPageChange],
  );

  // ---- Touch swipe ----
  useEffect(() => {
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
        onPageChange("next");
      } else {
        onPageChange("prev");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, onPageChange]);

  // ---- Keyboard listener ----
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
