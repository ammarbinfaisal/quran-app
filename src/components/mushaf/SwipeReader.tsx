"use client";

import { useRef, useCallback, useEffect } from "react";
import type { MushafCode } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { useMushafPage } from "@/hooks/useMushafPage";
import MushafPage from "@/components/mushaf/MushafPage";
import { PageSkeleton } from "@/components/mushaf/PageSkeleton";

interface SwipeReaderProps {
  currentPage: number;
  mushafCode: MushafCode;
  onPageChange: (page: number) => void;
  onWordTap: (verseKey: string) => void;
  highlightedVerse?: string | null;
}

/**
 * Single-page render slot inside the swipe container.
 * Separated so each page independently calls useMushafPage.
 */
function PageSlot({
  pageNumber,
  mushafCode,
  onWordTap,
  highlightedVerse,
}: {
  pageNumber: number;
  mushafCode: MushafCode;
  onWordTap: (verseKey: string) => void;
  highlightedVerse?: string | null;
}) {
  const { pageData, loading } = useMushafPage(mushafCode, pageNumber);

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
      />
    </div>
  );
}

export default function SwipeReader({
  currentPage,
  mushafCode,
  onPageChange,
  onWordTap,
  highlightedVerse,
}: SwipeReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build the 3-page window: [prev, current, next]
  const pages: number[] = [];
  if (currentPage > 1) pages.push(currentPage - 1);
  pages.push(currentPage);
  if (currentPage < TOTAL_PAGES) pages.push(currentPage + 1);

  // Index of the current page within the pages array
  const currentIndex = pages.indexOf(currentPage);

  // After mount or page change, scroll to the current page slot (no animation)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // In RTL, the scroll origin is at the right edge.
    // Each page occupies el.clientWidth. Index 0 is at scrollLeft 0 (rightmost).
    const targetScroll = currentIndex * el.clientWidth;
    el.scrollLeft = targetScroll;
  }, [currentPage, currentIndex]);

  // Scroll-snap settle detection
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Wait for scroll to settle (scroll-snap)
    scrollTimeoutRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;

      const pageWidth = el.clientWidth;
      if (pageWidth === 0) return;

      // Determine which slot index is visible
      const snappedIndex = Math.round(el.scrollLeft / pageWidth);
      const snappedPage = pages[snappedIndex];

      if (snappedPage !== undefined && snappedPage !== currentPage) {
        onPageChange(snappedPage);
      }
    }, 150);
  }, [currentPage, onPageChange, pages]);

  // Keyboard navigation: ArrowLeft = next page (RTL), ArrowRight = prev page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentPage < TOTAL_PAGES) {
          onPageChange(currentPage + 1);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentPage > 1) {
          onPageChange(currentPage - 1);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, onPageChange]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="swipe-container"
      onScroll={handleScroll}
    >
      {pages.map((pageNum) => (
        <PageSlot
          key={pageNum}
          pageNumber={pageNum}
          mushafCode={mushafCode}
          onWordTap={onWordTap}
          highlightedVerse={highlightedVerse}
        />
      ))}
    </div>
  );
}
