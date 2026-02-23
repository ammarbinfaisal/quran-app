"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { TOTAL_PAGES } from "@/lib/constants";
import type { Chapter } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { fetchVersePages } from "@/lib/navigation/maps";

interface NavigationPickerProps {
    open: boolean;
    onClose: () => void;
    onNavigate: (page: number, verseKey: string | null) => void;
}

export default function NavigationPicker({
    open,
    onClose,
    onNavigate,
}: NavigationPickerProps) {
    const chapters = useChapters();
    const { prefs } = usePreferences();
    const [searchQuery, setSearchQuery] = useState("");

    // Selection state
    const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null);
    const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
    const [selectedPage, setSelectedPage] = useState<number | null>(null);

    // Verse→page map (loaded lazily on first open)
    const verseMapRef = useRef<Record<string, number | [number, number]> | null>(null);

    useEffect(() => {
        if (!open) return;
        if (verseMapRef.current) return;
        fetchVersePages(prefs.mushafCode).then((map) => {
            verseMapRef.current = map;
        }).catch(() => { /* silent – we fall back to surah start page */ });
    }, [open, prefs.mushafCode]);

    // Reset map cache when mushaf changes
    useEffect(() => {
        verseMapRef.current = null;
    }, [prefs.mushafCode]);

    // Filtered chapters
    const filteredChapters = useMemo(() => {
        if (!searchQuery) return chapters;
        const q = searchQuery.toLowerCase();
        return chapters.filter(
            (c) =>
                c.nameSimple.toLowerCase().includes(q) ||
                c.nameArabic.includes(q) ||
                String(c.id).includes(q)
        );
    }, [chapters, searchQuery]);

    // All pages 1..TOTAL_PAGES — page column is always global and independent
    const allPages = useMemo(
        () => Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1),
        []
    );

    const handleSurahClick = (chapter: Chapter) => {
        setSelectedSurah(chapter);
        setSelectedAyah(null);
        setSelectedPage(chapter.pages[0]);
    };

    const handleAyahClick = (ayahNum: number) => {
        if (!selectedSurah) return;
        setSelectedAyah(ayahNum);

        // Resolve exact page for this verse if the map is loaded
        const verseKey = `${selectedSurah.id}:${ayahNum}`;
        const map = verseMapRef.current;
        if (map && map[verseKey] !== undefined) {
            const val = map[verseKey];
            const page = Array.isArray(val) ? val[0] : val;
            setSelectedPage(page);
        } else {
            // Fall back to surah start page
            setSelectedPage(selectedSurah.pages[0]);
        }
    };

    const handlePageClick = (p: number) => {
        setSelectedPage(p);
        // Clear ayah selection when page is tapped directly
        setSelectedAyah(null);
        setSelectedSurah(null);
    };

    const handleGo = () => {
        if (selectedPage !== null) {
            const verseKey =
                selectedSurah && selectedAyah
                    ? `${selectedSurah.id}:${selectedAyah}`
                    : null;
            resetState();
            onNavigate(selectedPage, verseKey);
        }
    };

    const resetState = () => {
        setSearchQuery("");
        setSelectedSurah(null);
        setSelectedAyah(null);
        setSelectedPage(null);
    };

    if (!open) return null;

    const canGo = selectedPage !== null;

    const handleClose = () => {
        resetState();
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />
            <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-2xl bg-[var(--color-surface)] shadow-lg flex flex-col h-[70vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-muted)]/20 shrink-0">
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-[var(--color-muted)]" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Surah..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full rounded-lg border-none bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-muted)]/70"
                        />
                    </div>
                    <button
                        onClick={handleClose}
                        className="ml-3 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] active:bg-black/5"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Columns Container */}
                <div className="flex-1 flex overflow-hidden min-h-0 bg-[var(--color-bg)]/30">

                    {/* Col 1: Surah */}
                    <div className="flex-1 overflow-y-auto border-r border-[var(--color-muted)]/10">
                        <div className="sticky top-0 bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] z-10 border-b border-[var(--color-muted)]/10">
                            Surah
                        </div>
                        <div className="p-2 space-y-1">
                            {filteredChapters.map((c) => {
                                const isActive = selectedSurah?.id === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSurahClick(c)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isActive
                                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                                            : "text-[var(--color-text)] active:bg-black/5"
                                            }`}
                                    >
                                        <span>{c.id}. {c.nameSimple}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Col 2: Ayah */}
                    <div className="w-[28%] overflow-y-auto border-r border-[var(--color-muted)]/10 bg-[var(--color-bg)]/50">
                        <div className="sticky top-0 bg-[var(--color-surface)]/95 backdrop-blur px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] z-10 border-b border-[var(--color-muted)]/10">
                            Ayah
                        </div>
                        <div className="p-2 space-y-1">
                            {selectedSurah ? (
                                Array.from({ length: selectedSurah.versesCount }, (_, i) => i + 1).map((a) => (
                                    <button
                                        key={a}
                                        onClick={() => handleAyahClick(a)}
                                        className={`w-full text-center px-1 py-2 rounded-md text-sm tabular-nums transition-colors ${selectedAyah === a
                                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                                            : "text-[var(--color-text)] active:bg-black/5"
                                            }`}
                                    >
                                        {a}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                                    Select Surah
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Col 3: Page — always shows all 604 pages, independent of surah */}
                    <div className="w-[28%] overflow-y-auto bg-[var(--color-bg)]/50">
                        <div className="sticky top-0 bg-[var(--color-surface)]/95 backdrop-blur px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] z-10 border-b border-[var(--color-muted)]/10">
                            Page
                        </div>
                        <div className="p-2 space-y-1">
                            {allPages.map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handlePageClick(p)}
                                    className={`w-full text-center px-1 py-2 rounded-md text-sm tabular-nums transition-colors ${selectedPage === p
                                        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                                        : "text-[var(--color-text)] active:bg-black/5"
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer: Go button */}
                <div className="shrink-0 px-4 py-3 border-t border-[var(--color-muted)]/20">
                    <button
                        onClick={handleGo}
                        disabled={!canGo}
                        className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 active:scale-[0.98]"
                    >
                        {selectedSurah && selectedAyah
                            ? `Go to ${selectedSurah.nameSimple} ${selectedAyah} (p. ${selectedPage})`
                            : selectedPage !== null
                                ? `Go to Page ${selectedPage}`
                                : "Select a destination"}
                    </button>
                </div>
            </div>
        </>
    );
}
