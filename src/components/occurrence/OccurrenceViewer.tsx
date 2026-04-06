"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { arabicToBuckwalter } from "@/lib/transliteration";
import { type MushafCode, type MushafWord as MushafWordType } from "@/lib/types";
import { VerseCard } from "@/components/lemma/VerseCard";
import { fetchVersePages, type VersePageMap } from "@/lib/navigation/maps";
import { dbGet, dbPut } from "@/lib/offline/storage";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import type { WordTapTarget } from "@/lib/wordTap";
import { useMushafPage } from "@/hooks/useMushafPage";
import { DATA_USAGE_POLICIES } from "@/lib/dataUsage";
import type { OnWordTap } from "@/lib/wordTap";

interface Occurrence {
    surah: number;
    ayah: number;
    word: number;
}

/** A group of occurrence verses that share the same mushaf page. */
interface PageGroup {
    page: number;
    verses: { verseKey: string; highlightedWords: number[] }[];
}

function getOccurrenceCacheKeys(dataUrl: string): { readKeys: string[]; writeKeys: string[] } {
    const readKeys: string[] = [dataUrl];
    const writeKeys: string[] = [dataUrl];

    const mLemma = /^\/data\/lemmas\/(.+)\.json$/.exec(dataUrl);
    if (mLemma?.[1]) {
        const key = decodeURIComponent(mLemma[1]);
        readKeys.unshift(key);
        writeKeys.unshift(key);
        return { readKeys, writeKeys };
    }

    const mRoot = /^\/data\/roots\/(.+)\.json$/.exec(dataUrl);
    if (mRoot?.[1]) {
        const key = `root:${decodeURIComponent(mRoot[1])}`;
        readKeys.unshift(key);
        writeKeys.unshift(key);
        return { readKeys, writeKeys };
    }

    return { readKeys, writeKeys };
}

export function OccurrenceViewer({
    displayArabic,
    subtitle,
    dataUrl,
    mushafCode,
    showModeToggle = true,
}: {
    displayArabic: string;
    subtitle: string;
    dataUrl: string;
    mushafCode: MushafCode;
    showModeToggle?: boolean;
}) {
    const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [versePages, setVersePages] = useState<VersePageMap | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
    const { prefs } = usePreferences();
    useApplyPreferences();

    const batchSize = DATA_USAGE_POLICIES[prefs.dataUsageMode].occurrenceBatchSize;

    // Fetch occurrence data
    const fetchRequestIdRef = useRef(0);
    const fetchControllerRef = useRef<AbortController | null>(null);
    const prevDataUrlRef = useRef<string | null>(null);
    if (prevDataUrlRef.current !== dataUrl) {
        prevDataUrlRef.current = dataUrl;
        fetchRequestIdRef.current += 1;
        const requestId = fetchRequestIdRef.current;
        fetchControllerRef.current?.abort();
        fetchControllerRef.current = null;
        setOccurrences(null);
        setLoading(true);
        setSelectedTap(null);

        queueMicrotask(() => {
            const controller = new AbortController();
            fetchControllerRef.current = controller;

            (async () => {
                const { readKeys, writeKeys } = getOccurrenceCacheKeys(dataUrl);

                try {
                    for (const cacheKey of readKeys) {
                        const cached = await dbGet<Occurrence[] | undefined>("lemmas", cacheKey);
                        if (fetchRequestIdRef.current !== requestId) return;
                        if (cached && Array.isArray(cached)) {
                            setOccurrences(cached);
                            setLoading(false);
                            return;
                        }
                    }
                } catch {
                    // IDB unavailable
                }

                try {
                    const res = await fetch(dataUrl, { signal: controller.signal });
                    if (!res.ok) throw new Error("not found");
                    const data: Occurrence[] = await res.json();
                    if (fetchRequestIdRef.current !== requestId || controller.signal.aborted) return;
                    for (const cacheKey of writeKeys) {
                        dbPut("lemmas", cacheKey, data).catch(() => { });
                    }
                    setOccurrences(data);
                    setLoading(false);
                } catch (error) {
                    if (fetchRequestIdRef.current !== requestId || controller.signal.aborted) return;
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    setOccurrences([]);
                    setLoading(false);
                }
            })();
        });
    }

    // Fetch verse-to-page mapping
    useMountEffect(() => {
        let active = true;
        fetchVersePages(mushafCode)
            .then((map) => { if (active) setVersePages(map); })
            .catch(() => {});
        return () => { active = false; };
    });

    // Group occurrences by verse, then by mushaf page
    const { pageGroups, totalVerses, totalOccurrences } = useMemo(() => {
        if (!occurrences || !versePages) return { pageGroups: null, totalVerses: 0, totalOccurrences: 0 };

        // Group by verse
        const grouped = new Map<string, number[]>();
        for (const occ of occurrences) {
            const key = `${occ.surah}:${occ.ayah}`;
            const existing = grouped.get(key) ?? [];
            existing.push(occ.word);
            grouped.set(key, existing);
        }

        // Map each verse to its mushaf page
        const pages = new Map<number, { verseKey: string; highlightedWords: number[] }[]>();
        const pageOrder: number[] = [];

        for (const [verseKey, words] of grouped) {
            const lookup = versePages[verseKey];
            if (!lookup) continue;
            const page = Array.isArray(lookup) ? lookup[0] : lookup;
            if (!pages.has(page)) {
                pages.set(page, []);
                pageOrder.push(page);
            }
            pages.get(page)!.push({ verseKey, highlightedWords: words });
        }

        // Sort by page number for sequential loading
        pageOrder.sort((a, b) => a - b);

        const groups: PageGroup[] = pageOrder.map((page) => ({
            page,
            verses: pages.get(page)!,
        }));

        return { pageGroups: groups, totalVerses: grouped.size, totalOccurrences: occurrences.length };
    }, [occurrences, versePages]);

    // Progressive page rendering
    const [pagesToShow, setPagesToShow] = useState(batchSize);
    const prevBatchSizeRef = useRef(batchSize);
    if (prevBatchSizeRef.current !== batchSize) {
        prevBatchSizeRef.current = batchSize;
        setPagesToShow((prev) => Math.max(prev, batchSize));
    }

    const totalPages = pageGroups?.length ?? 0;

    // Infinite scroll sentinel
    const observerInstanceRef = useRef<IntersectionObserver | null>(null);
    const sentinelRef = useCallback((node: HTMLDivElement | null) => {
        observerInstanceRef.current?.disconnect();
        observerInstanceRef.current = null;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setPagesToShow((prev) => Math.min(prev + batchSize, totalPages));
                }
            },
            { rootMargin: "600px" },
        );
        observer.observe(node);
        observerInstanceRef.current = observer;
    }, [batchSize, totalPages]);

    useMountEffect(() => {
        return () => {
            fetchRequestIdRef.current += 1;
            fetchControllerRef.current?.abort();
            observerInstanceRef.current?.disconnect();
        };
    });

    const isWaiting = loading || !versePages;
    const handleWordTap = useCallback((target: WordTapTarget) => {
        setSelectedTap(target);
    }, []);

    return (
        <div className="flex h-full w-full flex-col bg-[var(--color-bg)]">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="rounded-full p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]/10"
                    >
                        <Home className="h-5 w-5" />
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                            {subtitle}
                        </h1>
                        <h2 className="text-xl font-bold font-arabic text-[var(--color-accent)]">
                            {displayArabic}
                        </h2>
                    </div>
                </div>
                <div className="flex flex-col items-end text-sm text-[var(--color-muted)]">
                    <span>{totalOccurrences} occurrences</span>
                    {!loading && totalVerses > 0 && (
                        <span className="text-xs opacity-70">
                            {totalVerses} verses
                        </span>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-20">
                {isWaiting ? (
                    <div className="animate-pulse space-y-4 p-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-32 w-full rounded-xl bg-[var(--color-muted)]/10" />
                        ))}
                    </div>
                ) : pageGroups && pageGroups.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center text-[var(--color-muted)]">
                        <p className="text-lg">No occurrences found.</p>
                    </div>
                ) : pageGroups ? (
                    <div className="mx-auto max-w-3xl pb-10">
                        {pageGroups.slice(0, pagesToShow).map((group) => (
                            <OccurrencePageBatch
                                key={group.page}
                                pageNum={group.page}
                                mushafCode={mushafCode}
                                verses={group.verses}
                                onWordTap={handleWordTap}
                            />
                        ))}
                        {pagesToShow < totalPages && (
                            <div ref={sentinelRef}>
                                <div className="animate-pulse space-y-4 p-4">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </main>

            <ReaderBottomNav
                showModeToggle={showModeToggle}
                onDownloadsClick={() => setDownloadsOpen(true)}
                onSettingsClick={() => setSettingsOpen(true)}
            />

            <WordTapSheets
                selectedTap={selectedTap}
                translationIds={prefs.translationIds}
                mushafCode={mushafCode}
                onClose={() => {
                    setSelectedTap(null);
                }}
            />

            <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <DownloadManager open={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
        </div>
    );
}

/**
 * Renders all occurrence verses from a single mushaf page.
 * Mirrors VersePageBatch from VBV mode but filters to specific verse keys.
 */
function OccurrencePageBatch({
    pageNum,
    mushafCode,
    verses,
    onWordTap,
}: {
    pageNum: number;
    mushafCode: MushafCode;
    verses: { verseKey: string; highlightedWords: number[] }[];
    onWordTap: OnWordTap;
}) {
    const { pageData, fontReady, showFontSkeleton } = useMushafPage(mushafCode, pageNum);

    // Extract words for the filtered verses from this page's data
    const verseWords = useMemo(() => {
        if (!pageData) return null;
        const verseKeySet = new Set(verses.map((v) => v.verseKey));
        const blocks: Record<string, MushafWordType[]> = {};

        for (const line of pageData.lines) {
            for (const word of line.words) {
                if (!word.verseKey || !verseKeySet.has(word.verseKey)) continue;
                if (!blocks[word.verseKey]) blocks[word.verseKey] = [];
                blocks[word.verseKey].push(word);
            }
        }

        return blocks;
    }, [pageData, verses]);

    if (!pageData) {
        return (
            <div className="animate-pulse space-y-4 p-4">
                {verses.slice(0, 2).map((v) => (
                    <div key={v.verseKey} className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10" />
                ))}
            </div>
        );
    }

    return (
        <>
            {verses.map((v) => (
                <VerseCard
                    key={v.verseKey}
                    verseKey={v.verseKey}
                    words={verseWords?.[v.verseKey]}
                    mushafCode={mushafCode}
                    pageNum={pageNum}
                    fontReady={fontReady}
                    showFontSkeleton={showFontSkeleton}
                    onWordTap={onWordTap}
                    highlightedWords={v.highlightedWords}
                    showVerseLink
                />
            ))}
        </>
    );
}

/**
 * Builds the fetch URL for a lemma data file given the Arabic lemma string.
 */
export function lemmaDataUrl(arabicLemma: string): string {
    const bw = arabicToBuckwalter(arabicLemma);
    return `/data/lemmas/${encodeURIComponent(bw)}.json`;
}

/**
 * Builds the fetch URL for a root data file given the Buckwalter root string.
 */
export function rootDataUrl(buckwalterRoot: string): string {
    return `/data/roots/${encodeURIComponent(buckwalterRoot)}.json`;
}
