"use client";

import React, { useMemo, useEffect, useState } from "react";
import type { MushafCode, MushafWord as MushafWordType } from "@/lib/types";
import type { Chapter } from "@/lib/types";
import { useChapters } from "@/hooks/useChapters";
import { useMushafPage } from "@/hooks/useMushafPage";
import { usePreferences } from "@/hooks/usePreferences";
import type { JuzPageRange } from "@/lib/juz";
import { fetchJuzPagesForMushaf, fetchVersePages } from "@/lib/navigation/maps";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isQcfCode } from "@/lib/mushaf/fonts";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { loadTranslation } from "@/lib/translations/loader";
import { VerseCard } from "@/components/lemma/VerseCard";

interface VerseByVerseViewerProps {
    type: "p" | "s" | "j";
    id: number;
    mushafCode: MushafCode;
    onWordTap: (verseKey: string, wordIndex: number) => void;
    highlightedVerse?: string | null;
    onNavigate?: (type: "p" | "s" | "j", id: number) => void;
}

export function VerseByVerseViewer({
    type,
    id,
    mushafCode,
    onWordTap,
    highlightedVerse,
    onNavigate,
}: VerseByVerseViewerProps) {
    const chapters = useChapters();

    // Load mushaf-specific juz page ranges (async, mushaf-aware)
    const [juzRanges, setJuzRanges] = React.useState<readonly JuzPageRange[]>([]);
    useEffect(() => {
        if (type !== "j") return;
        fetchJuzPagesForMushaf()
            .then(setJuzRanges)
            .catch(() => { /* retain empty — pages won't load for juz mode */ });
    }, [type, mushafCode]);

    // Determine the full sequential range of pages we *can* load
    const fullPageRange = useMemo(() => {
        if (type === "p") return [id];
        if (type === "s" && chapters.length > 0) {
            const chapter = chapters.find((c) => c.id === id);
            if (chapter) {
                const start = chapter.pages[0];
                const end = chapter.pages[1];
                return Array.from({ length: end - start + 1 }, (_, i) => start + i);
            }
        }
        if (type === "j" && juzRanges.length > 0) {
            const juz = juzRanges.find((j) => j.juz === id);
            if (juz) {
                const start = juz.pages[0];
                const end = juz.pages[1];
                return Array.from({ length: end - start + 1 }, (_, i) => start + i);
            }
        }
        return [id];
    }, [type, id, chapters, juzRanges]);

    // Progressive rendering: Start with only max 5 pages, expand on scroll.
    // pagesToShow resets to 5 automatically when parent changes the `key` prop
    // (VerseReader passes key={type+":"+id} so React remounts this component on navigation).
    const [pagesToShow, setPagesToShow] = React.useState<number>(5);

    // If highlightedVerse is provided, ensure enough pages are loaded to show it
    useEffect(() => {
        if (!highlightedVerse || !isQcfCode(mushafCode)) return;

        async function ensureHighlightedPageLoaded() {
            if (!highlightedVerse) return;
            const versePages = await fetchVersePages(mushafCode);
            const lookup = versePages[highlightedVerse];
            if (!lookup) return;
            const targetPage = typeof lookup === "number" ? lookup : lookup[0];

            const pageIdx = fullPageRange.indexOf(targetPage);
            if (pageIdx !== -1 && pageIdx >= pagesToShow) {
                setPagesToShow(pageIdx + 1);
            }
        }
        ensureHighlightedPageLoaded();
    }, [highlightedVerse, mushafCode, fullPageRange, pagesToShow]);

    const visiblePages = useMemo(() => {
        return fullPageRange.slice(0, pagesToShow);
    }, [fullPageRange, pagesToShow]);

    // Use a callback ref for the sentinel so the observer always points at the
    // current DOM node, even if the sentinel mounts/unmounts as pagesToShow changes.
    const observerInstanceRef = React.useRef<IntersectionObserver | null>(null);
    const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
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
            { rootMargin: "2000px" }
        );
        observer.observe(node);
        observerInstanceRef.current = observer;
    }, [fullPageRange.length]);

    // Translation Prefetch: warm IDB for upcoming pages so VerseCard resolves instantly
    const { prefs } = usePreferences();
    useEffect(() => {
        if (prefs.translationIds.length === 0) return;

        // Pages just beyond the current visible window (next batch before sentinel fires)
        const prefetchPages = fullPageRange.slice(visiblePages.length, visiblePages.length + 5);
        if (prefetchPages.length === 0) return;

        let cancelled = false;

        async function prefetch() {
            for (const pageNum of prefetchPages) {
                if (cancelled) break;
                let pageData;
                try {
                    pageData = await loadMushafPage(mushafCode, pageNum);
                } catch {
                    continue;
                }
                if (cancelled) break;

                const verseKeys = new Set<string>();
                for (const line of pageData.lines) {
                    for (const word of line.words) {
                        if (word.verseKey) verseKeys.add(word.verseKey);
                    }
                }

                for (const verseKey of verseKeys) {
                    for (const tid of prefs.translationIds) {
                        loadTranslation(verseKey, tid).catch(() => {});
                    }
                }
            }
        }

        prefetch();
        return () => { cancelled = true; };
    }, [visiblePages, fullPageRange, mushafCode, prefs.translationIds]);

    // Navigation button labels
    const navButtons = useMemo(() => {
        if (!onNavigate) return null;
        let prev: { label: string; action: () => void } | null = null;
        let next: { label: string; action: () => void } | null = null;

        if (type === "p") {
            if (id > 1) prev = { label: `Page ${id - 1}`, action: () => onNavigate("p", id - 1) };
            if (id < 604) next = { label: `Page ${id + 1}`, action: () => onNavigate("p", id + 1) };
        } else if (type === "s") {
            if (id > 1) {
                const prevCh = chapters.find((c) => c.id === id - 1);
                prev = { label: prevCh?.nameSimple ?? `Surah ${id - 1}`, action: () => onNavigate("s", id - 1) };
            }
            if (id < 114) {
                const nextCh = chapters.find((c) => c.id === id + 1);
                next = { label: nextCh?.nameSimple ?? `Surah ${id + 1}`, action: () => onNavigate("s", id + 1) };
            }
        } else if (type === "j") {
            if (id > 1) prev = { label: `Juz ${id - 1}`, action: () => onNavigate("j", id - 1) };
            if (id < 30) next = { label: `Juz ${id + 1}`, action: () => onNavigate("j", id + 1) };
        }
        return { prev, next };
    }, [type, id, chapters, onNavigate]);

    // Auto-scroll to highlighted verse on mountain or highlight change
    useEffect(() => {
        if (!highlightedVerse) return;

        // Small delay to let progressive rendering and layout settle
        // We use a slightly longer delay (250ms) to ensure the target element exists and is positioned
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-verse-key="${highlightedVerse}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "instant", block: "start" });
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [highlightedVerse]);

    return (
        <div className="flex flex-col w-full max-w-3xl mx-auto pb-32">
            {visiblePages.map((p) => (
                <VersePageBatch
                    key={p}
                    pageNum={p}
                    mushafCode={mushafCode}
                    onWordTap={onWordTap}
                    highlightedVerse={highlightedVerse}
                    filterType={type}
                    filterId={id}
                    chapters={chapters}
                />
            ))}

            {/* Intersection sentinel — callback ref ensures observer is always registered */}
            {pagesToShow < fullPageRange.length && (
                <div ref={sentinelRef} className="h-10 w-full" />
            )}

            {/* Navigation buttons */}
            {navButtons && pagesToShow >= fullPageRange.length && (
                <div className="flex items-center justify-between px-4 py-6 gap-4">
                    {navButtons.next ? (
                        <button
                            type="button"
                            onClick={navButtons.next.action}
                            className="flex-1 min-w-0 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-3 py-3 text-xs font-medium text-[var(--color-text)] active:scale-[0.98] active:opacity-80 transition flex items-center justify-center gap-1.5 truncate"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{navButtons.next.label}</span>
                        </button>
                    ) : <div className="flex-1" />}
                    {navButtons.prev ? (
                        <button
                            type="button"
                            onClick={navButtons.prev.action}
                            className="flex-1 min-w-0 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-3 py-3 text-xs font-medium text-[var(--color-text)] active:scale-[0.98] active:opacity-80 transition flex items-center justify-center gap-1.5 truncate"
                        >
                            <span className="truncate">{navButtons.prev.label}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        </button>
                    ) : <div className="flex-1" />}
                </div>
            )}
        </div>
    );
}

function VersePageBatch({
    pageNum,
    mushafCode,
    onWordTap,
    highlightedVerse,
    filterType,
    filterId,
    chapters,
}: {
    pageNum: number;
    mushafCode: MushafCode;
    onWordTap: (verseKey: string, wordIndex: number) => void;
    highlightedVerse?: string | null;
    filterType: "p" | "s" | "j";
    filterId: number;
    chapters: Chapter[];
}) {
    const { pageData, fontReady, showFontSkeleton } = useMushafPage(mushafCode, pageNum);

    const verses = useMemo(() => {
        if (!pageData) return [];
        const blocks: Record<string, MushafWordType[]> = {};
        const order: string[] = [];

        for (const line of pageData.lines) {
            for (const word of line.words) {
                if (!word.verseKey) continue;
                if (filterType === "s") {
                    const surah = parseInt(word.verseKey.split(":")[0], 10);
                    if (surah !== filterId) continue;
                }
                if (!blocks[word.verseKey]) {
                    blocks[word.verseKey] = [];
                    order.push(word.verseKey);
                }
                blocks[word.verseKey].push(word);
            }
        }

        return order.map((key) => ({
            verseKey: key,
            words: blocks[key],
            chapter: chapters.find(c => c.id === parseInt(key.split(":")[0], 10)),
        }));
    }, [pageData, filterType, filterId, chapters]);

    if (!pageData) {
        return <div className="p-8 text-center text-[var(--color-muted)] animate-pulse">Loading verses...</div>;
    }

    return (
        <>
            {verses.map((v) => (
                <VerseCard
                    key={v.verseKey}
                    verseKey={v.verseKey}
                    words={v.words}
                    mushafCode={mushafCode}
                    pageNum={pageNum}
                    onWordTap={onWordTap}
                    isHighlighted={v.verseKey === highlightedVerse}
                    fontReady={fontReady}
                    showFontSkeleton={showFontSkeleton}
                    chapter={v.chapter}
                />
            ))}
        </>
    );
}


