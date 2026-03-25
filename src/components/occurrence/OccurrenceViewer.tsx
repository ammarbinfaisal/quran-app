"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { arabicToBuckwalter } from "@/lib/transliteration";
import { type MushafCode } from "@/lib/types";
import { VerseCard } from "@/components/lemma/VerseCard";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import { fetchVersePages } from "@/lib/navigation/maps";
import { dbGet, dbPut } from "@/lib/offline/storage";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import type { WordTapTarget } from "@/lib/wordTap";

interface Occurrence {
    surah: number;
    ayah: number;
    word: number;
}

const INITIAL_VISIBLE = 60;
const BATCH_SIZE = 20;

function getOccurrenceCacheKeys(dataUrl: string): { readKeys: string[]; writeKeys: string[] } {
    const readKeys: string[] = [dataUrl];
    const writeKeys: string[] = [dataUrl];

    // LemmaViewer / RootRoute use URL-encoded buckwalter in the path; downloads store by decoded key.
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
    /** Arabic text shown in the header */
    displayArabic: string;
    /** Label shown above the Arabic (e.g. "Lemma Lookup" or "Root") */
    subtitle: string;
    /** URL to fetch occurrences JSON from, e.g. /data/lemmas/foo.json */
    dataUrl: string;
    mushafCode: MushafCode;
    showModeToggle?: boolean;
}) {
    const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
    const [fontsReady, setFontsReady] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
    const { prefs } = usePreferences();
    useApplyPreferences();

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
        setVisibleCount(INITIAL_VISIBLE);
        setSelectedTap(null);
        setFontsReady(false);

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

    // Group by verse
    const allVerses = useMemo(() => {
        if (!occurrences) return [];
        const grouped = new Map<string, number[]>();
        for (const occ of occurrences) {
            const key = `${occ.surah}:${occ.ayah}`;
            const existing = grouped.get(key) ?? [];
            existing.push(occ.word);
            grouped.set(key, existing);
        }
        return Array.from(grouped.entries()).map(([verseKey, highlightedWords]) => ({
            verseKey,
            highlightedWords,
        }));
    }, [occurrences]);

    const visibleVerses = useMemo(() => allVerses.slice(0, visibleCount), [allVerses, visibleCount]);

    // Infinite scroll sentinel
    const observerInstanceRef = useRef<IntersectionObserver | null>(null);
    const allVersesLengthRef = useRef(allVerses.length);
    allVersesLengthRef.current = allVerses.length;
    const sentinelRef = useCallback((node: HTMLDivElement | null) => {
        observerInstanceRef.current?.disconnect();
        observerInstanceRef.current = null;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allVersesLengthRef.current));
                }
            },
            { rootMargin: "600px" },
        );
        observer.observe(node);
        observerInstanceRef.current = observer;
    }, []);

    // Font preloading for visible verses
    const prevFontSignatureRef = useRef<string | null>(null);
    const fontLoadActiveRef = useRef<{ cancel: () => void } | null>(null);
    const fontSignature = `${mushafCode}:${visibleVerses.map(({ verseKey }) => verseKey).join(",")}`;
    if (prevFontSignatureRef.current !== fontSignature) {
        prevFontSignatureRef.current = fontSignature;
        fontLoadActiveRef.current?.cancel();

        if (!isQcfCode(mushafCode) || visibleVerses.length === 0) {
            setFontsReady(true);
        } else {
            setFontsReady(false);

            let active = true;
            fontLoadActiveRef.current = {
                cancel: () => {
                    active = false;
                },
            };

            queueMicrotask(() => {
                if (!active) return;

                (async () => {
                    try {
                        const pagesMap = await fetchVersePages(mushafCode);
                        const pagesToLoad = new Set<number>();

                        for (const { verseKey } of visibleVerses) {
                            const pageLookup = pagesMap[verseKey];
                            if (!pageLookup) continue;
                            const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
                            const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
                            for (let p = startPage; p <= endPage; p++) {
                                pagesToLoad.add(p);
                            }
                        }

                        for (const page of pagesToLoad) {
                            if (!active) return;
                            await loadQcfFont(mushafCode, page);
                        }

                        if (active) {
                            setFontsReady(true);
                        }
                    } catch {
                        if (active) {
                            setFontsReady(true);
                        }
                    }
                })();
            });
        }
    }

    useMountEffect(() => {
        return () => {
            fetchRequestIdRef.current += 1;
            fetchControllerRef.current?.abort();
            fontLoadActiveRef.current?.cancel();
            observerInstanceRef.current?.disconnect();
        };
    });

    const isWaiting = loading || (isQcfCode(mushafCode) && !fontsReady && visibleVerses.length > 0);
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
                    <span>{occurrences?.length ?? 0} occurrences</span>
                    {!loading && allVerses.length > 0 && (
                        <span className="text-xs opacity-70">
                            showing {Math.min(visibleCount, allVerses.length)} of {allVerses.length} verses
                        </span>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 pb-20 space-y-6">
                {isWaiting ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-32 w-full rounded-xl bg-[var(--color-muted)]/10" />
                        ))}
                    </div>
                ) : visibleVerses.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center text-[var(--color-muted)]">
                        <p className="text-lg">No occurrences found.</p>
                    </div>
                ) : (
                    <div className="mx-auto max-w-3xl space-y-8 pb-10">
                        {visibleVerses.map(({ verseKey, highlightedWords }) => (
                            <VerseCard
                                key={verseKey}
                                verseKey={verseKey}
                                highlightedWords={highlightedWords}
                                mushafCode={mushafCode}
                                fontReady={fontsReady}
                                onWordTap={handleWordTap}
                                showVerseLink
                            />
                        ))}
                        {/* Infinite scroll sentinel */}
                        {visibleCount < allVerses.length && (
                            <div ref={sentinelRef}>
                                <div className="animate-pulse space-y-4">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
