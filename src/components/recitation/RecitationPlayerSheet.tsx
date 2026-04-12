"use client";

import { useMemo } from "react";
import { X, Play, Pause, SkipBack, SkipForward, Repeat, Loader2 } from "lucide-react";
import {
  useRecitationPlayer,
  type RangeMode,
  type RecitationRange,
} from "@/components/recitation/useRecitationPlayer";
import { useChapters } from "@/hooks/useChapters";
import { JUZ_PAGE_RANGES } from "@/lib/juz";

const RANGE_MODES: { value: RangeMode; label: string }[] = [
  { value: "surah", label: "Current Surah" },
  { value: "juz", label: "Current Juz" },
  { value: "page", label: "Current Page" },
];

interface RecitationPlayerSheetProps {
  open: boolean;
  onClose: () => void;
  currentPage?: number;
  currentSurahId?: number;
  currentJuzId?: number;
}

export function RecitationPlayerSheet({
  open,
  onClose,
  currentPage,
  currentSurahId,
  currentJuzId,
}: RecitationPlayerSheetProps) {
  const chapters = useChapters();
  const {
    status,
    rangeMode,
    setRangeMode,
    repeat,
    setRepeat,
    syncWithRecitation,
    setSyncWithRecitation,
    progress,
    currentVerseLabel,
    rangeLabel,
    range,
    togglePlayPause,
    playRange,
    skipBackward,
    skipForward,
    stop,
  } = useRecitationPlayer();

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const isActive = status !== "idle";

  // Build range based on current mode and context
  const currentRangeData = useMemo(() => {
    if (!chapters.length) return null;

    let startVerse = "";
    let endVerse = "";
    const verses: string[] = [];

    if (rangeMode === "surah" && currentSurahId) {
      const chapter = chapters.find((c) => c.id === currentSurahId);
      if (chapter) {
        for (let ayah = 1; ayah <= chapter.versesCount; ayah++) {
          verses.push(`${currentSurahId}:${ayah}`);
        }
        startVerse = `${currentSurahId}:1`;
        endVerse = `${currentSurahId}:${chapter.versesCount}`;
      }
    } else if (rangeMode === "juz" && currentJuzId) {
      const juzRange = JUZ_PAGE_RANGES.find((j) => j.juz === currentJuzId);
      if (juzRange) {
        // Find all verses in this juz
        for (const chapter of chapters) {
          const [surahStart, surahEnd] = chapter.pages;
          // Check if this surah overlaps with the juz pages
          if (surahEnd >= juzRange.pages[0] && surahStart <= juzRange.pages[juzRange.pages.length - 1]) {
            for (let ayah = 1; ayah <= chapter.versesCount; ayah++) {
              verses.push(`${chapter.id}:${ayah}`);
            }
          }
        }
        if (verses.length) {
          startVerse = verses[0];
          endVerse = verses[verses.length - 1];
        }
      }
    } else if (rangeMode === "page" && currentPage) {
      // Find verses on this page
      for (const chapter of chapters) {
        const [surahStart, surahEnd] = chapter.pages;
        if (currentPage >= surahStart && currentPage <= surahEnd) {
          // This surah spans the current page
          for (let ayah = 1; ayah <= chapter.versesCount; ayah++) {
            verses.push(`${chapter.id}:${ayah}`);
          }
        }
      }
      if (verses.length) {
        startVerse = verses[0];
        endVerse = verses[verses.length - 1];
      }
    }

    if (!verses.length) return null;

    return {
      mode: rangeMode,
      startVerse,
      endVerse,
      verses,
    } as RecitationRange;
  }, [rangeMode, currentSurahId, currentJuzId, currentPage, chapters]);

  const displayLabel = useMemo(() => {
    if (isActive && currentVerseLabel) return currentVerseLabel;
    if (currentRangeData) {
      if (rangeMode === "surah" && currentSurahId) {
        const chapter = chapters.find((c) => c.id === currentSurahId);
        return chapter ? `Surah ${chapter.nameSimple}` : `Surah ${currentSurahId}`;
      }
      if (rangeMode === "juz" && currentJuzId) {
        return `Juz ${currentJuzId}`;
      }
      if (rangeMode === "page" && currentPage) {
        return `Page ${currentPage}`;
      }
    }
    return "Select a range to play";
  }, [isActive, currentVerseLabel, currentRangeData, rangeMode, currentSurahId, currentJuzId, currentPage, chapters]);

  const handlePlay = async () => {
    if (isActive) {
      togglePlayPause();
    } else if (currentRangeData) {
      await playRange(currentRangeData);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-14 z-40 mx-auto w-full max-w-xl rounded-t-2xl bg-[var(--color-surface)] shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Handle + Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-muted)]/20">
        <div className="sheet-handle mx-0" />
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Now Playing / Range Info */}
        <div className="text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {isActive ? "Now Playing" : "Ready to Play"}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
            {displayLabel}
          </p>
          {isActive && rangeLabel && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Range: {rangeLabel}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/20">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={skipBackward}
            disabled={!isActive}
            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-text)] disabled:opacity-30 active:scale-95"
            aria-label="Previous verse"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={handlePlay}
            disabled={!currentRangeData && !isActive}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={skipForward}
            disabled={!isActive}
            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-text)] disabled:opacity-30 active:scale-95"
            aria-label="Next verse"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Range Selection */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Range
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {RANGE_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setRangeMode(mode.value)}
                className="rounded-lg border px-3 py-2.5 text-sm transition-colors"
                style={{
                  borderColor:
                    rangeMode === mode.value
                      ? "var(--color-accent)"
                      : "rgba(0,0,0,0.08)",
                  backgroundColor:
                    rangeMode === mode.value
                      ? "var(--color-surface)"
                      : "var(--color-bg)",
                  color:
                    rangeMode === mode.value
                      ? "var(--color-accent)"
                      : "var(--color-text)",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Repeat Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-muted)]/20 px-3 py-3">
            <div className="flex items-center gap-3">
              <Repeat className="h-4 w-4 text-[var(--color-muted)]" />
              <span className="text-sm text-[var(--color-text)]">Repeat Range</span>
            </div>
            <ToggleSwitch checked={repeat} onChange={setRepeat} />
          </div>

          {/* Sync Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-muted)]/20 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text)]">Highlight Verses</span>
            </div>
            <ToggleSwitch checked={syncWithRecitation} onChange={setSyncWithRecitation} />
          </div>
        </div>

        {/* Stop Button */}
        {isActive && (
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-lg border border-[var(--color-muted)]/20 px-3 py-3 text-sm text-[var(--color-muted)] active:opacity-80"
          >
            Stop Playback
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full transition-colors"
      style={{
        backgroundColor: checked ? "var(--color-accent)" : "var(--color-muted)",
        opacity: checked ? 1 : 0.4,
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}
