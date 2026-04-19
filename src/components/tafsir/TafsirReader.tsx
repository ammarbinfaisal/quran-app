"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { fetchUthmaniText } from "@/lib/api";
import { loadTafsirEntry, type TafsirEntry } from "@/lib/tafsir/loader";
import {
  TAFSIR_IDS,
  TAFSIR_DISPLAY_NAMES,
  TAFSIR_ARABIC_NAMES,
  type TafsirId,
} from "@/lib/types";
import { tafsirPath } from "@/lib/url";

export function TafsirReader({
  tafsirId,
  surahId,
  ayahId,
}: {
  tafsirId: TafsirId;
  surahId: number;
  ayahId: number;
}) {
  const router = useRouter();
  const chapters = useChapters();
  useApplyPreferences();

  const chapter = chapters.find((c) => c.id === surahId);
  const verseKey = `${surahId}:${ayahId}`;

  const [arabicText, setArabicText] = useState<string | null>(null);
  const [tafsirEntry, setTafsirEntry] = useState<TafsirEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTafsir, setActiveTafsir] = useState<TafsirId>(tafsirId);

  // Load Arabic text and tafsir on mount
  useMountEffect(() => {
    let cancelled = false;

    async function load() {
      const [arabic, entry] = await Promise.all([
        fetchUthmaniText(verseKey),
        loadTafsirEntry(activeTafsir, surahId, ayahId),
      ]);

      if (!cancelled) {
        setArabicText(arabic || null);
        setTafsirEntry(entry);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  });

  // Switch tafsir without full page navigation
  const handleTafsirSwitch = useCallback(
    async (newTafsirId: TafsirId) => {
      setActiveTafsir(newTafsirId);
      setLoading(true);
      const entry = await loadTafsirEntry(newTafsirId, surahId, ayahId);
      setTafsirEntry(entry);
      setLoading(false);
      // Update URL without full navigation
      window.history.replaceState(null, "", tafsirPath(newTafsirId, surahId, ayahId));
    },
    [surahId, ayahId],
  );

  // Navigation
  const canGoPrev = ayahId > 1;
  const canGoNext = chapter ? ayahId < chapter.versesCount : false;

  const navigatePrev = useCallback(() => {
    if (canGoPrev) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId - 1));
    }
  }, [router, activeTafsir, surahId, ayahId, canGoPrev]);

  const navigateNext = useCallback(() => {
    if (canGoNext) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId + 1));
    }
  }, [router, activeTafsir, surahId, ayahId, canGoNext]);

  // Grouped entry range label
  const rangeLabel = useMemo(() => {
    if (!tafsirEntry?.ayahsStart || !tafsirEntry?.count || tafsirEntry.count <= 1) return null;
    const start = tafsirEntry.ayahsStart;
    const end = start + tafsirEntry.count - 1;
    return `${surahId}:${start}–${end}`;
  }, [tafsirEntry, surahId]);

  const attributionUrl = `https://tafsir.app/${activeTafsir}/${surahId}/${ayahId}`;

  return (
    <main className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]">
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 animate-fade-in">
          {/* Arabic verse */}
          <div className="mb-6 rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-muted)] tabular-nums">
                {chapter?.nameSimple} {verseKey}
              </span>
              <span className="font-arabic text-xs text-[var(--color-muted)]" dir="rtl">
                {chapter?.nameArabic}
              </span>
            </div>
            {arabicText ? (
              <p
                className="font-arabic text-2xl leading-[2.2] text-[var(--color-text)]"
                dir="rtl"
              >
                {arabicText}
              </p>
            ) : (
              <div className="space-y-2 py-2">
                <div className="h-6 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                <div className="h-6 w-3/4 rounded bg-[var(--color-muted)]/15 animate-pulse" />
              </div>
            )}
          </div>

          {/* Tafsir tab switcher */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {TAFSIR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTafsirSwitch(id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                  activeTafsir === id
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-muted)] active:opacity-70"
                }`}
              >
                {TAFSIR_ARABIC_NAMES[id]}
              </button>
            ))}
          </div>

          {/* Tafsir content */}
          <div className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {TAFSIR_DISPLAY_NAMES[activeTafsir]}
              </h2>
              <a
                href={attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition"
              >
                tafsir.app
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {rangeLabel && (
              <div className="mb-3 text-xs text-[var(--color-muted)]">
                Covers ayaat {rangeLabel}
              </div>
            )}

            {loading ? (
              <div className="space-y-2 py-2">
                <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
                <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                <div className="h-4 w-3/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
              </div>
            ) : tafsirEntry?.text ? (
              <TafsirContent html={tafsirEntry.text} />
            ) : (
              <p className="py-4 text-center text-sm text-[var(--color-muted)]">
                No tafsir available for this ayah.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav with prev/next */}
      <ReaderBottomNav
        showBack
        visible
        centerLabel={{
          text: verseKey,
          ariaLabel: `Verse ${verseKey}`,
          onClick: () => {
            // Could open a verse picker in future
          },
          size: "sm",
        }}
        centerExtra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={navigatePrev}
              disabled={!canGoPrev}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 disabled:opacity-30 transition"
              aria-label="Previous ayah"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={navigateNext}
              disabled={!canGoNext}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 disabled:opacity-30 transition"
              aria-label="Next ayah"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
        showModeToggle={false}
        showRecitation={false}
        showSettings={false}
        showOfflineIndicator={false}
      />
    </main>
  );
}

/**
 * Renders tafsir HTML content. The HTML comes from our own scraped JSON files
 * in public/data/tafsir/ — first-party content from tafsir.app, not user input.
 */
function TafsirContent({ html }: { html: string }) {
  return (
    <div
      className="font-arabic text-base leading-[2] text-[var(--color-text)] whitespace-pre-line"
      dir="rtl"
      // Content is from our own static JSON files (scraped from tafsir.app).
      // Not user-generated — safe to render as HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
