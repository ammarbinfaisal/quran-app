"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Home, Settings, Download } from "lucide-react";
import { buckwalterToArabic, arabicToBuckwalter } from "@/lib/transliteration";
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

export function LemmaViewer({
    lemma,
    mushafCode,
}: {
    lemma: string;
    mushafCode: MushafCode;
}) {
    const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const { prefs } = usePreferences();
    const { applyTheme } = useTheme();

    useEffect(() => {
        applyTheme(prefs.theme);
        document.documentElement.style.setProperty("--mushaf-font-scale", String(prefs.fontScale));
    }, [applyTheme, prefs.fontScale, prefs.theme]);

    useEffect(() => {
        let active = true;
        async function fetchLemmas() {
            try {
                // Try IndexedDB cache first
                const cached = await dbGet<Occurrence[] | undefined>("lemmas", lemma);
                if (cached && Array.isArray(cached)) {
                    if (active) {
                        setOccurrences(cached);
                        setLoading(false);
                    }
                    return;
                }
            } catch {
                // IndexedDB unavailable — fall through to network
            }

            try {
                const bwLemma = arabicToBuckwalter(lemma);
                const res = await fetch(`/data/lemmas/${encodeURIComponent(bwLemma)}.json`);
                if (!res.ok) throw new Error("not found");
                const data = await res.json();
                if (active) {
                    setOccurrences(data);
                    setLoading(false);
                }
            } catch {
                if (active) {
                    setOccurrences([]);
                    setLoading(false);
                }
            }
        }
        fetchLemmas();
        return () => {
            active = false;
        };
    }, [lemma]);

    const [fontsReady, setFontsReady] = useState(false);

    // Group by verse
    const verses = useMemo(() => {
        if (!occurrences) return [];
        const grouped = new Map<string, number[]>();
        for (const occ of occurrences) {
            const key = `${occ.surah}:${occ.ayah}`;
            const existing = grouped.get(key) || [];
            existing.push(occ.word);
            grouped.set(key, existing);
        }
        return Array.from(grouped.entries()).map(([verseKey, words]) => ({
            verseKey,
            highlightedWords: words,
        })).slice(0, 60);
    }, [occurrences]);

    // Pre-load fonts for all verses in this lemma view
    useEffect(() => {
        let active = true;
        async function loadFonts() {
            if (!isQcfCode(mushafCode)) {
                setFontsReady(true);
                return;
            }
            if (verses.length === 0) return;

            try {
                const pagesMap = await fetchVersePages(mushafCode);
                const pagesToLoad = new Set<number>();

                for (const { verseKey } of verses) {
                    const pageLookup = pagesMap[verseKey];
                    if (pageLookup) {
                        const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
                        const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
                        for (let p = startPage; p <= endPage; p++) {
                            pagesToLoad.add(p);
                        }
                    }
                }

                // Sequential background loading to avoid parallel HTTP floods
                for (const p of Array.from(pagesToLoad)) {
                    if (!active) break;
                    await loadQcfFont(mushafCode, p);
                }
                if (active) setFontsReady(true);
            } catch {
                // Even if it fails, set to true so cards can render skeleton/fallbacks
                if (active) setFontsReady(true);
            }
        }
        loadFonts();
        return () => { active = false; };
    }, [verses, mushafCode]);

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
                            Lemma Lookup
                        </h1>
                        <h2 className="text-xl font-bold font-arabic text-[var(--color-accent)]">
                            {buckwalterToArabic(lemma)}
                        </h2>
                    </div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">
                    {occurrences?.length ?? 0} Occurrences
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 pb-20 space-y-6">
                {loading || (isQcfCode(mushafCode) && !fontsReady && verses.length > 0) ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-32 w-full rounded-xl bg-[var(--color-muted)]/10"
                            />
                        ))}
                    </div>
                ) : verses.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center text-[var(--color-muted)]">
                        <p className="text-lg">No occurrences found.</p>
                    </div>
                ) : (
                    <div className="mx-auto max-w-3xl space-y-8 pb-10">
                        {verses.map(({ verseKey, highlightedWords }) => (
                            <VerseCard
                                key={verseKey}
                                verseKey={verseKey}
                                highlightedWords={highlightedWords}
                                mushafCode={mushafCode}
                                fontReady={fontsReady}
                            />
                        ))}
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

                <ModeToggle />

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
