"use client";

import React, { useMemo, useEffect, useState } from "react";
import type { MushafCode, MushafWord as MushafWordType, TranslationId } from "@/lib/types";
import { TRANSLATION_DISPLAY_NAMES } from "@/lib/types";
import { useChapters } from "@/hooks/useChapters";
import { useMushafPage } from "@/hooks/useMushafPage";
import { MushafWord } from "@/components/mushaf/MushafWord";
import { useTranslations } from "@/hooks/useTranslations";
import { usePreferences } from "@/hooks/usePreferences";
import type { JuzPageRange } from "@/lib/juz";
import { fetchJuzPagesForMushaf, fetchVersePages } from "@/lib/navigation/maps";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import { ExternalLink } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import {
    parseTranslationSegments,
    type FootnoteReference,
} from "@/lib/footnotes";
import { FootnoteSheet } from "@/components/ayah/FootnoteSheet";

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

    // Serial Font Loading
    useEffect(() => {
        let active = true;
        async function loadFonts() {
            if (!isQcfCode(mushafCode)) return;
            for (const p of visiblePages) {
                if (!active) break;
                try {
                    await loadQcfFont(mushafCode, p);
                } catch {
                    // Silently fail, MushafWord handles missing fonts with skeleton
                }
            }
        }
        loadFonts();
        return () => { active = false; };
    }, [mushafCode, visiblePages]);

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
                    {navButtons.prev ? (
                        <button
                            type="button"
                            onClick={navButtons.prev.action}
                            className="flex-1 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text)] active:scale-[0.98] active:opacity-80 transition"
                        >
                            &larr; {navButtons.prev.label}
                        </button>
                    ) : <div className="flex-1" />}
                    {navButtons.next ? (
                        <button
                            type="button"
                            onClick={navButtons.next.action}
                            className="flex-1 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text)] active:scale-[0.98] active:opacity-80 transition"
                        >
                            {navButtons.next.label} &rarr;
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
    const { pageData, fontReady } = useMushafPage(mushafCode, pageNum);
    const { prefs } = usePreferences();

    const verses = useMemo(() => {
        if (!pageData) return [];
        const blocks: Record<string, MushafWordType[]> = {};
        const order: string[] = [];

        for (const line of pageData.lines) {
            for (const word of line.words) {
                if (!word.verseKey) continue;

                // Filter by type
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
        }));
    }, [pageData, filterType, filterId]);

    if (!pageData) {
        return <div className="p-8 text-center text-[var(--color-muted)] animate-pulse">Loading verses...</div>;
    }

    return (
        <>
            {verses.map((v) => (
                <VerseBlock
                    key={v.verseKey}
                    verseKey={v.verseKey}
                    words={v.words}
                    mushafCode={mushafCode}
                    pageNum={pageNum}
                    onWordTap={onWordTap}
                    isHighlighted={v.verseKey === highlightedVerse}
                    fontReady={fontReady}
                    translationIds={prefs.translationIds}
                    chapters={chapters}
                />
            ))}
        </>
    );
}

function VerseBlock({
    verseKey,
    words,
    mushafCode,
    pageNum,
    onWordTap,
    isHighlighted,
    fontReady,
    translationIds,
    chapters,
}: {
    verseKey: string;
    words: MushafWordType[];
    mushafCode: MushafCode;
    pageNum: number;
    onWordTap: (verseKey: string, wordIndex: number) => void;
    isHighlighted: boolean;
    fontReady: boolean;
    translationIds: TranslationId[];
    chapters: Chapter[];
}) {
    const translations = useTranslations(verseKey, translationIds);
    const { prefs } = usePreferences();

    const [footnoteSheetOpen, setFootnoteSheetOpen] = useState(false);
    const [activeFootnotes, setActiveFootnotes] = useState<{
        refs: FootnoteReference[];
        label: string;
    } | null>(null);

    const [surahNum, ayahNum] = useMemo(() => {
        const parts = verseKey.split(":");
        return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    }, [verseKey]);

    const chapter = useMemo(() => chapters.find(c => c.id === surahNum), [chapters, surahNum]);

    function handleFootnoteClick(tid: TranslationId, ref: FootnoteReference) {
        setActiveFootnotes({
            refs: [ref],
            label: TRANSLATION_DISPLAY_NAMES[tid] ?? tid,
        });
        setFootnoteSheetOpen(true);
    }

    return (
        <div
            className="border-b border-muted/1 px-4 py-8"
            style={{
                contentVisibility: "auto",
                containIntrinsicBlockSize: "auto 200px"
            }}
            data-highlighted={isHighlighted}
            data-verse-key={verseKey}
        >
            {ayahNum === 1 && chapter && (
                <div className="mb-10">
                    <SurahHeader
                        nameSimple={chapter.nameSimple}
                        surahNumber={chapter.id}
                        showBismillah={
                            !!chapter.bismillahPre &&
                            chapter.id !== 1 &&
                            chapter.id !== 9
                        }
                    />
                </div>
            )}

            <div className="flex flex-col items-end gap-3 mb-8" dir="rtl">
                <div className="text-xs font-bold text-muted tabular-nums border border-muted/20 px-2 py-0.5 rounded shadow-sm">
                    {verseKey}
                </div>
                <div
                    className="flex flex-wrap gap-x-2.5 gap-y-5 leading-[2.5]"
                    style={{
                        fontSize: `clamp(1.25rem, ${(prefs.fontScale ?? 3) * 0.35 + 1}rem, 3.5rem)`,
                    }}
                >
                    {words.map((word, idx) => {
                        const morphIndex = word.charTypeName === "word"
                            ? words.slice(0, idx).filter(w => w.charTypeName === "word").length
                            : -1;

                        return (
                            <MushafWord
                                key={`${word.verseKey}-${idx}`}
                                word={word}
                                wordIndex={morphIndex}
                                mushafCode={mushafCode}
                                pageNum={pageNum}
                                onTap={() => onWordTap(verseKey, morphIndex)}
                                highlighted={isHighlighted}
                                fontReady={fontReady}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="space-y-5 max-w-2xl mx-auto" style={{
                fontSize: `clamp(0.85rem, ${(prefs.fontScale ?? 3) * 0.04 + 0.75}rem, 1.2rem)`,
            }}>
                {translationIds.map((tidStr) => {
                    const tid = tidStr as TranslationId;
                    const data = translations[tid];
                    if (!data || data.loading) {
                        return (
                            <div key={tid} className="animate-pulse bg-[var(--color-muted)]/10 h-6 w-3/4 rounded" />
                        );
                    }
                    if (!data.text) return null;
                    const isAbuIyaad = tid === "abu-iyaad";
                    const displayName = TRANSLATION_DISPLAY_NAMES[tid] ?? tid;
                    const segments = parseTranslationSegments(data.text);
                    return (
                        <div key={tid}>
                            <div className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest mb-2 opacity-60 flex items-center gap-2">
                                <span>{displayName}</span>
                                {isAbuIyaad && (
                                    <a
                                        href={`https://www.thenoblequran.com/q/#/verse/${surahNum}/${ayahNum}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 hover:text-[var(--color-accent)] transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                            <div className="text-[1.05em] text-[var(--color-text)] opacity-90 leading-relaxed font-medium">
                                {segments.map((part, idx) => {
                                    if (part.type === "text") {
                                        return <span key={idx}>{part.text}</span>;
                                    }
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleFootnoteClick(tid, { id: part.id, label: part.label })}
                                            className="inline-flex items-center justify-center px-1 text-[10px] font-bold text-[var(--color-accent)] hover:underline active:opacity-60"
                                            aria-label={`Footnote ${part.label}`}
                                        >
                                            [{part.label}]
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeFootnotes && (
                <FootnoteSheet
                    open={footnoteSheetOpen}
                    onClose={() => setFootnoteSheetOpen(false)}
                    footnoteRefs={activeFootnotes.refs}
                    translationLabel={activeFootnotes.label}
                />
            )}
        </div>
    );
}
