"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { TOTAL_PAGES } from "@/lib/constants";
import type { Chapter } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { fetchVersePages } from "@/lib/navigation/maps";
import type { QuranSearchHit, QuranSearchResponse } from "@/lib/search";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LIMIT = 30;

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
  const [searchResults, setSearchResults] = useState<QuranSearchHit[]>([]);
  const [searchTotalMatches, setSearchTotalMatches] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selection state
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  // Verse→page map (loaded lazily on first open)
  const verseMapRef = useRef<Record<string, number | [number, number]> | null>(null);

  const searchQueryTrimmed = searchQuery.trim();
  const hasSearchText = searchQueryTrimmed.length > 0;

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchTotalMatches(0);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
  };

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

  useEffect(() => {
    if (!hasSearchText) return;

    const controller = new AbortController();
    let active = true;
    const timeoutId = window.setTimeout(() => {
      fetch(
        `/api/search?q=${encodeURIComponent(searchQueryTrimmed)}&limit=${SEARCH_RESULTS_LIMIT}`,
        { signal: controller.signal },
      )
        .then(async (res) => {
          const payload = (await res.json().catch(() => null)) as unknown;
          if (!res.ok) {
            const error =
              typeof payload === "object" &&
              payload !== null &&
              "error" in payload &&
              typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : "Search is unavailable right now.";
            throw new Error(error);
          }
          return payload as QuranSearchResponse;
        })
        .then((data) => {
          if (!active) return;
          setSearchResults(data.results);
          setSearchTotalMatches(data.total_matches);
        })
        .catch((error: unknown) => {
          if (!active) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchError(
            error instanceof Error ? error.message : "Search is unavailable right now.",
          );
        })
        .finally(() => {
          if (!active) return;
          setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hasSearchText, searchQueryTrimmed]);

  const chaptersById = useMemo(() => {
    const byId = new Map<number, Chapter>();
    for (const chapter of chapters) {
      byId.set(chapter.id, chapter);
    }
    return byId;
  }, [chapters]);

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

  const handleSearchResultClick = (hit: QuranSearchHit) => {
    const chapter = chaptersById.get(hit.surah) ?? null;
    setSelectedSurah(chapter);
    setSelectedAyah(hit.ayah);

    const verseKey = `${hit.surah}:${hit.ayah}`;
    const map = verseMapRef.current;
    if (map && map[verseKey] !== undefined) {
      const val = map[verseKey];
      setSelectedPage(Array.isArray(val) ? val[0] : val);
      return;
    }
    setSelectedPage(chapter?.pages[0] ?? null);
  };

  const handlePageClick = (p: number) => {
    setSelectedPage(p);
    // Clear ayah selection when page is tapped directly.
    setSelectedAyah(null);
    setSelectedSurah(null);
  };

  const resetState = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchTotalMatches(0);
    setSearchLoading(false);
    setSearchError(null);
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

  const renderSearchPanel = () => {
    if (searchError && searchResults.length === 0) {
      return (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-xs text-red-700">
          {searchError}
        </div>
      );
    }

    if (!searchLoading && searchResults.length === 0) {
      return (
        <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
          No matches for <span className="font-medium text-[var(--color-text)]">{searchQueryTrimmed}</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {searchLoading && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg)]/70 px-3 py-2 text-xs text-[var(--color-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}
        {searchError && searchResults.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            {searchError}
          </div>
        )}
        {searchResults.map((hit) => {
          const chapter = chaptersById.get(hit.surah);
          const isActive = selectedSurah?.id === hit.surah && selectedAyah === hit.ayah;
          return (
            <button
              key={hit.verse_key}
              onClick={() => handleSearchResultClick(hit)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                  : "border-[var(--color-muted)]/20 bg-[var(--color-surface)] active:bg-black/5"
              }`}
            >
              <div className="text-[11px] text-[var(--color-muted)]">
                {chapter?.nameSimple ?? `Surah ${hit.surah}`} · Ayah {hit.ayah}
              </div>
              <p
                className="mt-1 text-base leading-7 text-[var(--color-text)]"
                dir="rtl"
                lang="ar"
              >
                {hit.text_uthmani}
              </p>
            </button>
          );
        })}
      </div>
    );
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
              placeholder="Search Quran text..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              aria-label="Search Quran text"
              className="block w-full rounded-lg border-none bg-[var(--color-bg)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {searchLoading ? (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted)]" />
              </div>
            ) : hasSearchText ? (
              <button
                type="button"
                onClick={() => handleSearchInputChange("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-muted)]"
                aria-label="Clear search query"
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
          {/* Col 1: Surah / Search results */}
          <div className="flex-1 overflow-y-auto border-r border-[var(--color-muted)]/10">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <span>{hasSearchText ? "Search" : "Surah"}</span>
              {hasSearchText && !searchLoading && searchTotalMatches > 0 && (
                <span className="text-[10px] normal-case tracking-normal">
                  {searchTotalMatches} match{searchTotalMatches === 1 ? "" : "es"}
                </span>
              )}
            </div>
            <div className="p-2 space-y-1">
              {hasSearchText
                ? renderSearchPanel()
                : chapters.map((c) => {
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
                  })}
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
