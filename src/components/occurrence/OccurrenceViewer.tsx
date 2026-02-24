"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Home, Settings, Download } from "lucide-react";
import { arabicToBuckwalter } from "@/lib/transliteration";
import { type MushafCode } from "@/lib/types";
import { VerseCard } from "@/components/lemma/VerseCard";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import { fetchVersePages } from "@/lib/navigation/maps";
import { dbGet } from "@/lib/offline/storage";
import { ModeToggle } from "@/components/navigation/ModeToggle";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { useTheme } from "@/hooks/useTheme";
import { usePreferences } from "@/hooks/usePreferences";

interface Occurrence {
    surah: number;
    ayah: number;
    word: number;
}

const INITIAL_VISIBLE = 60;
const BATCH_SIZE = 20;

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const { prefs } = usePreferences();
    const { applyTheme } = useTheme();

    useEffect(() => {
        applyTheme(prefs.theme);
        document.documentElement.style.setProperty("--mushaf-font-scale", String(prefs.fontScale));
    }, [applyTheme, prefs.fontScale, prefs.theme]);

    // Fetch occurrences – try IDB cache keyed on dataUrl, fall back to network
    useEffect(() => {
        let active = true;
        setLoading(true);
        setVisibleCount(INITIAL_VISIBLE);

        async function fetchData() {
            try {
                const cacheKey = dataUrl;
                const cached = await dbGet<Occurrence[] | undefined>("lemmas", cacheKey);
                if (cached && Array.isArray(cached)) {
                    if (active) { setOccurrences(cached); setLoading(false); }
                    return;
                }
            } catch { /* IDB unavailable */ }

            try {
                const res = await fetch(dataUrl);
                if (!res.ok) throw new Error("not found");
                const data: Occurrence[] = await res.json();
                if (active) { setOccurrences(data); setLoading(false); }
            } catch {
                if (active) { setOccurrences([]); setLoading(false); }
            }
        }

        fetchData();
        return () => { active = false; };
    }, [dataUrl]);

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
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allVerses.length));
                }
            },
            { rootMargin: "600px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [allVerses.length, visibleCount]);

    // Font preloading for visible verses
    const [fontsReady, setFontsReady] = useState(false);

    useEffect(() => {
        let active = true;
        async function loadFonts() {
            if (!isQcfCode(mushafCode)) { setFontsReady(true); return; }
            if (visibleVerses.length === 0) return;

            try {
                const pagesMap = await fetchVersePages(mushafCode);
                const pagesToLoad = new Set<number>();

                for (const { verseKey } of visibleVerses) {
                    const pageLookup = pagesMap[verseKey];
                    if (pageLookup) {
                        const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
                        const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
                        for (let p = startPage; p <= endPage; p++) pagesToLoad.add(p);
                    }
                }

                for (const p of Array.from(pagesToLoad)) {
                    if (!active) break;
                    await loadQcfFont(mushafCode, p);
                }
                if (active) setFontsReady(true);
            } catch {
                if (active) setFontsReady(true);
            }
        }
        loadFonts();
        return () => { active = false; };
    }, [visibleVerses, mushafCode]);

    const isWaiting = loading || (isQcfCode(mushafCode) && !fontsReady && visibleVerses.length > 0);

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

            <nav
                className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm px-2"
                style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
            >
                <Link
                    href="/"
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
                >
                    <Home className="h-5 w-5" />
                </Link>

                {showModeToggle && <ModeToggle />}

                <div className="flex items-center">
                    <OfflineIndicator />
                    <button
                        type="button"
                        onClick={() => setDownloadsOpen(true)}
                        className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)]"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)]"
                    >
                        <Settings className="h-5 w-5" />
                    </button>
                </div>
            </nav>

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
