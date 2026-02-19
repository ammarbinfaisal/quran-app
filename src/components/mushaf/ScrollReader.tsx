"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import type { MushafCode } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { useMushafPage } from "@/hooks/useMushafPage";
import MushafPage from "@/components/mushaf/MushafPage";
import { PageSkeleton } from "@/components/mushaf/PageSkeleton";

interface ScrollReaderProps {
  currentPage: number;
  mushafCode: MushafCode;
  onPageChange: (page: number) => void;
  onWordTap: (verseKey: string) => void;
  highlightedVerse?: string | null;
}

/**
 * Single-page render slot inside the scroll container.
 * Each slot independently fetches its page data via useMushafPage.
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
    return <PageSkeleton />;
  }

  return (
    <MushafPage
      pageData={pageData}
      mushafCode={mushafCode}
      onWordTap={onWordTap}
      highlightedVerse={highlightedVerse}
    />
  );
}

export default function ScrollReader({
  currentPage,
  mushafCode,
  onPageChange,
  onWordTap,
  highlightedVerse,
}: ScrollReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const currentPageRef = useRef(currentPage);
  const ignoreObserverRef = useRef(false);
  const ignoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build the 5-page window: [current-2 .. current+2], clamped
  const pages = useMemo(() => {
    const out: number[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      const p = currentPage + offset;
      if (p >= 1 && p <= TOTAL_PAGES) out.push(p);
    }
    return out;
  }, [currentPage]);

  // Ref callback to track page DOM elements
  const setPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) {
        pageRefsMap.current.set(pageNum, el);
      } else {
        pageRefsMap.current.delete(pageNum);
      }
    },
    [],
  );

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // IntersectionObserver: detect which page is most visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const visibilityMap = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (ignoreObserverRef.current) return;
        for (const entry of entries) {
          const pageNum = Number(
            (entry.target as HTMLElement).dataset.pageNumber,
          );
          if (isNaN(pageNum)) continue;
          visibilityMap.set(pageNum, entry.intersectionRatio);
        }

        // Find the page with the highest intersection ratio
        let bestPage = currentPageRef.current;
        let bestRatio = 0;
        for (const [pageNum, ratio] of visibilityMap) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = pageNum;
          }
        }

        if (bestPage !== currentPageRef.current && bestRatio >= 0.55) {
          onPageChange(bestPage);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    // Observe all page elements currently in the map
    for (const el of pageRefsMap.current.values()) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [onPageChange, pages]);

  // On mount / page change, scroll to the current page without animation
  useEffect(() => {
    const el = pageRefsMap.current.get(currentPage);
    if (el) {
      ignoreObserverRef.current = true;
      if (ignoreTimerRef.current) clearTimeout(ignoreTimerRef.current);
      ignoreTimerRef.current = setTimeout(() => {
        ignoreObserverRef.current = false;
      }, 350);

      el.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (ignoreTimerRef.current) clearTimeout(ignoreTimerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="scroll-container">
      {pages.map((pageNum) => (
        <div
          key={pageNum}
          ref={(el) => setPageRef(pageNum, el)}
          data-page-number={pageNum}
          style={{ aspectRatio: "var(--mushaf-aspect-ratio)" }}
          className="w-full flex items-center justify-center py-3"
        >
          <PageSlot
            pageNumber={pageNum}
            mushafCode={mushafCode}
            onWordTap={onWordTap}
            highlightedVerse={highlightedVerse}
          />
        </div>
      ))}
    </div>
  );
}
