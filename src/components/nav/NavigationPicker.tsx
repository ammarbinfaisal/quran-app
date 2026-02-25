"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
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
  const [surahFilter, setSurahFilter] = useState("");

  // Selection state
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  // Verse→page map (loaded lazily on first open)
  const verseMapRef = useRef<Record<string, number | [number, number]> | null>(null);

  const surahFilterTrimmed = surahFilter.trim().toLowerCase();
  const hasSurahFilter = surahFilterTrimmed.length > 0;

  useEffect(() => {
    if (!open) return;
    if (verseMapRef.current) return;
    fetchVersePages(prefs.mushafCode)
      .then((map) => {
        verseMapRef.current = map;
      })
      .catch(() => {
        // Silent fallback: selected ayah will use surah start page.
      });
  }, [open, prefs.mushafCode]);

  // Reset map cache when mushaf changes
  useEffect(() => {
    verseMapRef.current = null;
  }, [prefs.mushafCode]);

  // Surah filtering is purely client-side; no API calls here.

  const filteredChapters = useMemo(() => {
    if (!hasSurahFilter) return chapters;
    const q = surahFilterTrimmed;
    const raw = surahFilter.trim();
    return chapters.filter((c) => {
      if (String(c.id).startsWith(q)) return true;
      if (c.nameSimple.toLowerCase().includes(q)) return true;
      if (raw && c.nameArabic.includes(raw)) return true;
      return false;
    });
  }, [chapters, hasSurahFilter, surahFilter, surahFilterTrimmed]);

  // All pages 1..TOTAL_PAGES — page column is always global and independent.
  const allPages = useMemo(
    () => Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1),
    [],
  );

  const handleSurahClick = (chapter: Chapter) => {
    setSelectedSurah(chapter);
    setSelectedAyah(null);
    setSelectedPage(chapter.pages[0]);
  };

  const handleAyahClick = (ayahNum: number) => {
    if (!selectedSurah) return;
    setSelectedAyah(ayahNum);

    // Resolve exact page for this verse if the map is loaded.
    const verseKey = `${selectedSurah.id}:${ayahNum}`;
    const map = verseMapRef.current;
    if (map && map[verseKey] !== undefined) {
      const val = map[verseKey];
      const page = Array.isArray(val) ? val[0] : val;
      setSelectedPage(page);
    } else {
      // Fall back to surah start page.
      setSelectedPage(selectedSurah.pages[0]);
    }
  };

  const handlePageClick = (p: number) => {
    setSelectedPage(p);
    // Clear ayah selection when page is tapped directly.
    setSelectedAyah(null);
    setSelectedSurah(null);
  };

  const resetState = () => {
    setSurahFilter("");
    setSelectedSurah(null);
    setSelectedAyah(null);
    setSelectedPage(null);
  };

  const handleGo = () => {
    if (selectedPage === null) return;
    const verseKey =
      selectedSurah && selectedAyah ? `${selectedSurah.id}:${selectedAyah}` : null;
    resetState();
    onNavigate(selectedPage, verseKey);
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
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[70vh] w-full max-w-xl flex-col rounded-t-2xl bg-[var(--color-surface)] shadow-lg">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-muted)]/20 px-4 py-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-[var(--color-muted)]" />
            </div>
            <input
              type="text"
              placeholder="Search surah by number or name…"
              value={surahFilter}
              onChange={(e) => setSurahFilter(e.target.value)}
              aria-label="Search surah"
              className="block w-full rounded-lg border-none bg-[var(--color-bg)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {hasSurahFilter ? (
              <button
                type="button"
                onClick={() => setSurahFilter("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-muted)]"
                aria-label="Clear surah filter"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            onClick={handleClose}
            className="ml-3 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] active:bg-black/5"
            aria-label="Close navigation picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Columns Container */}
        <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--color-bg)]/30">
          {/* Col 1: Surah */}
          <div className="flex-1 overflow-y-auto border-r border-[var(--color-muted)]/10">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <span>Surah</span>
              {hasSurahFilter && (
                <span className="text-[10px] normal-case tracking-normal">
                  {filteredChapters.length} result{filteredChapters.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="p-2 space-y-1">
              {filteredChapters.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
                  No surahs match{" "}
                  <span className="font-medium text-[var(--color-text)]">
                    {surahFilter.trim()}
                  </span>
                  .
                </div>
              ) : (
                filteredChapters.map((c) => {
                  const isActive = selectedSurah?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSurahClick(c)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
                          : "text-[var(--color-text)] active:bg-black/5"
                      }`}
                    >
                      <span>
                        {c.id}. {c.nameSimple}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Col 2: Ayah */}
          <div className="w-[28%] overflow-y-auto border-r border-[var(--color-muted)]/10 bg-[var(--color-bg)]/50">
            <div className="sticky top-0 z-10 border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] backdrop-blur">
              Ayah
            </div>
            <div className="space-y-1 p-2">
              {selectedSurah ? (
                Array.from({ length: selectedSurah.versesCount }, (_, i) => i + 1).map((a) => (
                  <button
                    key={a}
                    onClick={() => handleAyahClick(a)}
                    className={`w-full rounded-md px-1 py-2 text-center text-sm tabular-nums transition-colors ${
                      selectedAyah === a
                        ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
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
            <div className="sticky top-0 z-10 border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] backdrop-blur">
              Page
            </div>
            <div className="space-y-1 p-2">
              {allPages.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePageClick(p)}
                  className={`w-full rounded-md px-1 py-2 text-center text-sm tabular-nums transition-colors ${
                    selectedPage === p
                      ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
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
        <div className="shrink-0 border-t border-[var(--color-muted)]/20 px-4 py-3">
          <button
            onClick={handleGo}
            disabled={!canGo}
            className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition-opacity active:scale-[0.98] disabled:opacity-40"
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
