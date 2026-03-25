"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { TOTAL_PAGES } from "@/lib/constants";
import type { Chapter, MushafCode } from "@/lib/types";
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
  const { prefs } = usePreferences();

  if (!open) return null;

  return (
    <NavigationPickerContent
      key={prefs.mushafCode}
      mushafCode={prefs.mushafCode}
      onClose={onClose}
      onNavigate={onNavigate}
    />
  );
}

function NavigationPickerContent({
  mushafCode,
  onClose,
  onNavigate,
}: {
  mushafCode: MushafCode;
  onClose: () => void;
  onNavigate: (page: number, verseKey: string | null) => void;
}) {
  const chapters = useChapters();
  const [surahFilter, setSurahFilter] = useState("");
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [verseMap, setVerseMap] = useState<Record<string, number | [number, number]> | null>(null);

  useMountEffect(() => {
    let active = true;
    fetchVersePages(mushafCode)
      .then((map) => {
        if (active) {
          setVerseMap(map);
        }
      })
      .catch(() => {
        // Silent fallback: selected ayah will use surah start page.
      });
    return () => {
      active = false;
    };
  });

  const surahFilterTrimmed = surahFilter.trim().toLowerCase();
  const hasSurahFilter = surahFilterTrimmed.length > 0;

  const filteredChapters = useMemo(() => {
    if (!hasSurahFilter) return chapters;
    const raw = surahFilter.trim();
    return chapters.filter((chapter) => {
      if (String(chapter.id).startsWith(surahFilterTrimmed)) return true;
      if (chapter.nameSimple.toLowerCase().includes(surahFilterTrimmed)) return true;
      if (raw && chapter.nameArabic.includes(raw)) return true;
      return false;
    });
  }, [chapters, hasSurahFilter, surahFilter, surahFilterTrimmed]);

  const allPages = useMemo(
    () => Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1),
    [],
  );

  const resetState = () => {
    setSurahFilter("");
    setSelectedSurah(null);
    setSelectedAyah(null);
    setSelectedPage(null);
  };

  const handleSurahClick = (chapter: Chapter) => {
    setSelectedSurah(chapter);
    setSelectedAyah(null);
    setSelectedPage(chapter.pages[0]);
  };

  const handleAyahClick = (ayahNum: number) => {
    if (!selectedSurah) return;
    setSelectedAyah(ayahNum);
    const verseKey = `${selectedSurah.id}:${ayahNum}`;
    const mapped = verseMap?.[verseKey];
    const page =
      mapped === undefined
        ? selectedSurah.pages[0]
        : Array.isArray(mapped)
          ? mapped[0]
          : mapped;
    setSelectedPage(page);
  };

  const handlePageClick = (page: number) => {
    setSelectedPage(page);
    setSelectedAyah(null);
    setSelectedSurah(null);
  };

  const handleGo = () => {
    if (selectedPage === null) return;
    const verseKey =
      selectedSurah && selectedAyah ? `${selectedSurah.id}:${selectedAyah}` : null;
    resetState();
    onNavigate(selectedPage, verseKey);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[70vh] w-full max-w-xl flex-col rounded-t-2xl bg-[var(--color-surface)] shadow-lg">
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

        <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--color-bg)]/30">
          <div className="flex-1 overflow-y-auto border-r border-[var(--color-muted)]/10">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <span>Surah</span>
              {hasSurahFilter && (
                <span className="text-[10px] normal-case tracking-normal">
                  {filteredChapters.length} result{filteredChapters.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="space-y-1 p-2">
              {filteredChapters.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
                  No surahs match{" "}
                  <span className="font-medium text-[var(--color-text)]">
                    {surahFilter.trim()}
                  </span>
                  .
                </div>
              ) : (
                filteredChapters.map((chapter) => {
                  const isActive = selectedSurah?.id === chapter.id;
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => handleSurahClick(chapter)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
                          : "text-[var(--color-text)] active:bg-black/5"
                      }`}
                    >
                      <span>
                        {chapter.id}. {chapter.nameSimple}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="w-[28%] overflow-y-auto border-r border-[var(--color-muted)]/10 bg-[var(--color-bg)]/50">
            <div className="sticky top-0 z-10 border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] backdrop-blur">
              Ayah
            </div>
            <div className="space-y-1 p-2">
              {selectedSurah ? (
                Array.from({ length: selectedSurah.versesCount }, (_, index) => index + 1).map((ayahNum) => (
                  <button
                    key={ayahNum}
                    onClick={() => handleAyahClick(ayahNum)}
                    className={`w-full rounded-md px-1 py-2 text-center text-sm tabular-nums transition-colors ${
                      selectedAyah === ayahNum
                        ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
                        : "text-[var(--color-text)] active:bg-black/5"
                    }`}
                  >
                    {ayahNum}
                  </button>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                  Select Surah
                </div>
              )}
            </div>
          </div>

          <div className="w-[28%] overflow-y-auto bg-[var(--color-bg)]/50">
            <div className="sticky top-0 z-10 border-b border-[var(--color-muted)]/10 bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold uppercase text-[var(--color-muted)] backdrop-blur">
              Page
            </div>
            <div className="space-y-1 p-2">
              {allPages.map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageClick(page)}
                  className={`w-full rounded-md px-1 py-2 text-center text-sm tabular-nums transition-colors ${
                    selectedPage === page
                      ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
                      : "text-[var(--color-text)] active:bg-black/5"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--color-muted)]/20 px-4 py-3">
          <button
            onClick={handleGo}
            disabled={selectedPage === null}
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
