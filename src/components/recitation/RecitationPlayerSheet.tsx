"use client";

import { useMemo, useRef, useState } from "react";
import { X, Play, Pause, SkipBack, SkipForward, Repeat, Loader2 } from "lucide-react";
import {
  useRecitationPlayer,
  type RecitationRange,
} from "@/components/recitation/useRecitationPlayer";
import { useChapters } from "@/hooks/useChapters";
import { fetchVersePages, type VersePageMap } from "@/lib/navigation/maps";
import {
  buildVerseList,
  clampAyah,
  juzBounds,
  parseVerseKey,
  surahBounds,
  type RangeBounds,
} from "@/lib/recitationRange";
import { showToast } from "@/lib/toast";
import type { Chapter } from "@/lib/types";

interface RecitationPlayerSheetProps {
  open: boolean;
  onClose: () => void;
  currentPage?: number;
  currentSurahId?: number;
  currentJuzId?: number;
}

function pageBoundsFromMap(
  page: number,
  versePages: VersePageMap | null,
): RangeBounds | null {
  if (!versePages) return null;
  let firstVerse: string | null = null;
  let lastVerse: string | null = null;
  for (const [vk, lookup] of Object.entries(versePages)) {
    const start = typeof lookup === "number" ? lookup : lookup[0];
    const end = typeof lookup === "number" ? lookup : lookup[1];
    if (end < page || start > page) continue;
    if (!firstVerse) firstVerse = vk;
    lastVerse = vk;
  }
  if (!firstVerse || !lastVerse) return null;
  return { startVerse: firstVerse, endVerse: lastVerse };
}

function defaultBoundsForView(
  chapters: Chapter[],
  currentSurahId: number | undefined,
  currentJuzId: number | undefined,
  currentPage: number | undefined,
  versePages: VersePageMap | null,
): RangeBounds {
  if (currentSurahId) {
    const bounds = surahBounds(currentSurahId, chapters);
    if (bounds) return bounds;
  }
  if (currentPage) {
    const bounds = pageBoundsFromMap(currentPage, versePages);
    if (bounds) return bounds;
  }
  if (currentJuzId) {
    const bounds = juzBounds(currentJuzId);
    if (bounds) return bounds;
  }
  return { startVerse: "1:1", endVerse: "1:7" };
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
    repeat,
    setRepeat,
    progress,
    currentVerseLabel,
    rangeLabel,
    togglePlayPause,
    playRange,
    skipBackward,
    skipForward,
    stop,
  } = useRecitationPlayer();

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const isActive = status !== "idle";

  // Lazy-load verse-pages so the page default is accurate.
  const [versePages, setVersePages] = useState<VersePageMap | null>(null);
  const versePagesFetchedRef = useRef(false);
  if (open && !versePages && !versePagesFetchedRef.current) {
    versePagesFetchedRef.current = true;
    fetchVersePages("v2")
      .then((map) => setVersePages(map))
      .catch(() => {
        versePagesFetchedRef.current = false;
      });
  }

  // Initial defaults derived from the active view.
  const initialBounds = useMemo(
    () =>
      defaultBoundsForView(
        chapters,
        currentSurahId,
        currentJuzId,
        currentPage,
        versePages,
      ),
    [chapters, currentSurahId, currentJuzId, currentPage, versePages],
  );

  // User-edited bounds; reset when the sheet opens or the view changes.
  const [startVerse, setStartVerse] = useState(initialBounds.startVerse);
  const [endVerse, setEndVerse] = useState(initialBounds.endVerse);
  const lastSyncedKey = useRef<string>("");

  if (open) {
    const key = `${initialBounds.startVerse}-${initialBounds.endVerse}`;
    if (lastSyncedKey.current !== key) {
      lastSyncedKey.current = key;
      queueMicrotask(() => {
        setStartVerse(initialBounds.startVerse);
        setEndVerse(initialBounds.endVerse);
      });
    }
  }

  const startRef = parseVerseKey(startVerse);
  const endRef = parseVerseKey(endVerse);

  // Build the final verse list for the chosen bounds. If start > end, we keep
  // the list empty (button stays disabled).
  const previewVerses = useMemo(() => {
    if (!startRef || !endRef) return [];
    if (
      startRef.surah > endRef.surah ||
      (startRef.surah === endRef.surah && startRef.ayah > endRef.ayah)
    ) {
      return [];
    }
    return buildVerseList(startVerse, endVerse, chapters);
  }, [startVerse, endVerse, chapters, startRef, endRef]);

  const verseCount = previewVerses.length;

  const startChapter = startRef ? chapters.find((c) => c.id === startRef.surah) : undefined;
  const endChapter = endRef ? chapters.find((c) => c.id === endRef.surah) : undefined;

  const handleStartSurah = (surahId: number) => {
    const ayah = startRef ? clampAyah(surahId, startRef.ayah, chapters) : 1;
    setStartVerse(`${surahId}:${ayah}`);
  };
  const handleStartAyah = (ayahValue: string) => {
    if (!startRef) return;
    const ayah = clampAyah(startRef.surah, Number.parseInt(ayahValue, 10) || 1, chapters);
    setStartVerse(`${startRef.surah}:${ayah}`);
  };
  const handleEndSurah = (surahId: number) => {
    const ayah = endRef
      ? clampAyah(surahId, endRef.ayah, chapters)
      : (chapters.find((c) => c.id === surahId)?.versesCount ?? 1);
    setEndVerse(`${surahId}:${ayah}`);
  };
  const handleEndAyah = (ayahValue: string) => {
    if (!endRef) return;
    const ayah = clampAyah(endRef.surah, Number.parseInt(ayahValue, 10) || 1, chapters);
    setEndVerse(`${endRef.surah}:${ayah}`);
  };

  const handlePlay = async () => {
    if (isActive) {
      togglePlayPause();
      return;
    }
    if (!verseCount) {
      showToast("Pick a valid verse range to play.", "warning");
      return;
    }
    const newRange: RecitationRange = {
      mode: "custom",
      startVerse,
      endVerse,
      verses: previewVerses,
    };
    await playRange(newRange);
  };

  if (!open) return null;

  const headerLabel = isActive
    ? currentVerseLabel ?? "Now Playing"
    : verseCount > 0
      ? `${startVerse} – ${endVerse}`
      : "Pick a range";

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div
        className="sheet-content"
        data-open="true"
        role="dialog"
        aria-label="Recitation player"
      >
        <div className="sheet-handle" />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              {isActive ? "Now playing" : "Ready"}
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-[var(--color-text)]">
              {headerLabel}
            </p>
            {isActive && rangeLabel && (
              <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                Range: {rangeLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-[0.97] active:opacity-80"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/15">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Transport controls */}
        <div className="mb-5 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={skipBackward}
            disabled={!isActive}
            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-text)] active:scale-95 disabled:opacity-30"
            aria-label="Previous verse"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={handlePlay}
            disabled={!isActive && verseCount === 0}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] shadow-md active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="ml-0.5 h-7 w-7" />
            )}
          </button>

          <button
            type="button"
            onClick={skipForward}
            disabled={!isActive}
            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-text)] active:scale-95 disabled:opacity-30"
            aria-label="Next verse"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Range picker */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Range
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">
              {verseCount > 0 ? `${verseCount} verse${verseCount === 1 ? "" : "s"}` : "Invalid range"}
            </span>
          </div>

          <VersePickerRow
            label="From"
            chapters={chapters}
            verseRef={startRef}
            chapter={startChapter}
            onSurahChange={handleStartSurah}
            onAyahChange={handleStartAyah}
          />
          <VersePickerRow
            label="To"
            chapters={chapters}
            verseRef={endRef}
            chapter={endChapter}
            onSurahChange={handleEndSurah}
            onAyahChange={handleEndAyah}
          />
        </div>

        {/* Repeat toggle */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <Repeat className="h-4 w-4 text-[var(--color-muted)]" />
            <span className="text-sm text-[var(--color-text)]">Repeat range</span>
          </div>
          <ToggleSwitch checked={repeat} onChange={setRepeat} />
        </div>

        {isActive && (
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-xl border border-[var(--color-muted)]/20 px-3 py-3 text-sm font-medium text-[var(--color-muted)] active:opacity-80"
          >
            Stop playback
          </button>
        )}
      </div>
    </>
  );
}

function VersePickerRow({
  label,
  chapters,
  verseRef,
  chapter,
  onSurahChange,
  onAyahChange,
}: {
  label: string;
  chapters: Chapter[];
  verseRef: { surah: number; ayah: number } | null;
  chapter: Chapter | undefined;
  onSurahChange: (surahId: number) => void;
  onAyahChange: (ayahValue: string) => void;
}) {
  const maxAyah = chapter?.versesCount ?? 286;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3 py-2.5">
      <span className="w-10 shrink-0 text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <select
        value={verseRef?.surah ?? 1}
        onChange={(event) => onSurahChange(Number.parseInt(event.target.value, 10))}
        className="flex-1 min-w-0 truncate rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        aria-label={`${label} surah`}
      >
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id}. {c.nameSimple}
          </option>
        ))}
      </select>
      <span className="text-[var(--color-muted)]">:</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={maxAyah}
        value={verseRef?.ayah ?? 1}
        onChange={(event) => onAyahChange(event.target.value)}
        className="w-16 shrink-0 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-2 py-2 text-center text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        aria-label={`${label} ayah`}
      />
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
