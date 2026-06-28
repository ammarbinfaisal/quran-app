"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { MushafCode, Chapter } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { useChapters } from "@/hooks/useChapters";
import { useMushafPage } from "@/hooks/useMushafPage";
import type { JuzPageRange } from "@/lib/juz";
import { fetchJuzPagesForMushaf, fetchVersePages } from "@/lib/navigation/maps";
import MushafPage from "@/components/mushaf/MushafPage";
import { PageSkeleton } from "@/components/mushaf/PageSkeleton";
import { ReaderPrevNext } from "@/components/navigation/ReaderPrevNext";
import type { OnWordTap } from "@/lib/wordTap";
import { usePreferences } from "@/hooks/usePreferences";
import { useReaderDataPrefetch } from "@/hooks/useReaderDataPrefetch";

interface ScrollReaderProps {
  type: "p" | "s" | "j";
  id: number;
  mushafCode: MushafCode;
  onWordTap: OnWordTap;
  highlightedVerse?: string | null;
  onNavigate?: (type: "p" | "s" | "j", id: number) => void;
  focusPage?: number | null;
}

export default function ScrollReader({
  type,
  id,
  mushafCode,
  onWordTap,
  highlightedVerse,
  onNavigate,
  focusPage,
}: ScrollReaderProps) {
  const chapters = useChapters();
  const { prefs } = usePreferences();
  const [juzRanges, setJuzRanges] = useState<readonly JuzPageRange[]>([]);
  const [pagesToShow, setPagesToShow] = useState(5);
  const didAutoScrollToHighlightRef = useRef(false);
  const lastHighlightedVerseRef = useRef<string | null>(null);

  useMountEffect(() => {
    if (type !== "j") return;
    fetchJuzPagesForMushaf().then(setJuzRanges).catch(() => {});
  });

  const fullPageRange = useMemo(() => {
    if (type === "p") return [id];
    if (type === "s" && chapters.length > 0) {
      const chapter = chapters.find((c) => c.id === id);
      if (chapter) {
        const [start, end] = chapter.pages;
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
    }
    if (type === "j" && juzRanges.length > 0) {
      const juz = juzRanges.find((entry) => entry.juz === id);
      if (juz) {
        const [start, end] = juz.pages;
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
    }
    return [id];
  }, [type, id, chapters, juzRanges]);

  const visiblePages = useMemo(() => fullPageRange.slice(0, pagesToShow), [fullPageRange, pagesToShow]);

  useReaderDataPrefetch({
    mushafCode,
    dataUsageMode: prefs.dataUsageMode,
    translationIds: prefs.translationIds,
    scopeType: type,
    focusPage: focusPage ?? fullPageRange[0] ?? null,
    scopePages: fullPageRange,
    tafsirOrder: prefs.tafsirOrder,
  });

  // Combined mount effect: look up highlighted verse page, ensure it's loaded, then scroll to it
  useMountEffect(() => {
    if (!highlightedVerse) return;

    lastHighlightedVerseRef.current = highlightedVerse;
    didAutoScrollToHighlightRef.current = false;

    let active = true;

    fetchVersePages(mushafCode).then((versePages) => {
      if (!active) return;
      const lookup = versePages[highlightedVerse];
      if (!lookup) return;
      const targetPage = typeof lookup === "number" ? lookup : lookup[0];
      const indexInRange = fullPageRange.indexOf(targetPage);
      if (indexInRange !== -1) {
        setPagesToShow((prev) => (prev >= indexInRange + 1 ? prev : indexInRange + 1));
      }

      // Wait for the target page DOM node to appear, then scroll to it
      function tryScroll() {
        if (!active || didAutoScrollToHighlightRef.current) return;
        const pageNode = document.querySelector(`[data-scroll-page="${targetPage}"]`);
        if (pageNode) {
          didAutoScrollToHighlightRef.current = true;
          pageNode.scrollIntoView({ behavior: "instant", block: "start" });
          return;
        }
        requestAnimationFrame(tryScroll);
      }
      setTimeout(tryScroll, 80);
    }).catch(() => {});

    return () => {
      active = false;
    };
  });

  const observerInstanceRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerInstanceRef.current) {
      observerInstanceRef.current.disconnect();
      observerInstanceRef.current = null;
    }
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPagesToShow((prev) => Math.min(prev + 5, fullPageRange.length));
        }
      },
      { rootMargin: "1600px" },
    );
    observer.observe(node);
    observerInstanceRef.current = observer;
  }, [fullPageRange.length]);

  const navButtons = useMemo(() => {
    if (!onNavigate) return null;
    let prev: { label: string; action: () => void } | null = null;
    let next: { label: string; action: () => void } | null = null;

    if (type === "p") {
      if (id > 1) prev = { label: `Page ${id - 1}`, action: () => onNavigate("p", id - 1) };
      if (id < TOTAL_PAGES) next = { label: `Page ${id + 1}`, action: () => onNavigate("p", id + 1) };
    } else if (type === "s") {
      if (id > 1) {
        const previous = chapters.find((c) => c.id === id - 1);
        prev = { label: previous?.nameSimple ?? `Surah ${id - 1}`, action: () => onNavigate("s", id - 1) };
      }
      if (id < 114) {
        const upcoming = chapters.find((c) => c.id === id + 1);
        next = { label: upcoming?.nameSimple ?? `Surah ${id + 1}`, action: () => onNavigate("s", id + 1) };
      }
    } else {
      if (id > 1) prev = { label: `Juz ${id - 1}`, action: () => onNavigate("j", id - 1) };
      if (id < 30) next = { label: `Juz ${id + 1}`, action: () => onNavigate("j", id + 1) };
    }

    return { prev, next };
  }, [chapters, id, onNavigate, type]);

  return (
    <div className="flex w-full max-w-5xl flex-col mx-auto pb-32">
      {visiblePages.map((pageNumber) => (
        <ScrollPageSlot
          key={pageNumber}
          pageNumber={pageNumber}
          mushafCode={mushafCode}
          onWordTap={onWordTap}
          highlightedVerse={highlightedVerse}
          chapters={chapters}
        />
      ))}

      {pagesToShow < fullPageRange.length && (
        <div ref={sentinelRef} className="h-8 w-full" />
      )}

      {navButtons && pagesToShow >= fullPageRange.length && (
        <ReaderPrevNext prev={navButtons.prev} next={navButtons.next} />
      )}
    </div>
  );
}

function ScrollPageSlot({
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

  if (loading || !pageData) {
    return (
      <div className="px-2 py-2" data-scroll-page={pageNumber}>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="px-2 py-2" data-scroll-page={pageNumber}>
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
