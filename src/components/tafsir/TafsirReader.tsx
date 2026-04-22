"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import { ArabicVerseBlock } from "@/components/ayah/ArabicVerseBlock";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { TafsirSwitcher } from "@/components/tafsir/TafsirSwitcher";
import { fetchVersePages } from "@/lib/navigation/maps";
import {
  loadTafsirAvailability,
  loadTafsirEntry,
  getAvailableTafsirIds,
  getTafsirAvailabilitySync,
  type TafsirAvailability,
  type TafsirEntry,
} from "@/lib/tafsir/loader";
import { scheduleTafsirPrefetch } from "@/lib/tafsir/prefetch";
import {
  TAFSIR_DISPLAY_NAMES,
  type TafsirId,
} from "@/lib/types";
import { tafsirPath, vbvPath } from "@/lib/url";
import type { WordTapTarget } from "@/lib/wordTap";

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
  const { prefs } = usePreferences();
  useApplyPreferences();

  const chapter = chapters.find((c) => c.id === surahId);
  const verseKey = `${surahId}:${ayahId}`;

  const [activeTafsir, setActiveTafsir] = useState<TafsirId>(tafsirId);
  const [tafsirEntry, setTafsirEntry] = useState<TafsirEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTafsir, setPendingTafsir] = useState<TafsirId | null>(null);
  const [availability, setAvailability] = useState<TafsirAvailability | null>(
    () => getTafsirAvailabilitySync(),
  );
  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load availability manifest + active tafsir on mount. Keyed component —
  // page.tsx remounts us on every URL change, so mount is the right scope.
  useMountEffect(() => {
    let cancelled = false;

    (async () => {
      const [manifest, entry] = await Promise.all([
        loadTafsirAvailability(),
        loadTafsirEntry(activeTafsir, surahId, ayahId),
      ]);
      if (cancelled) return;
      setAvailability(manifest);
      setTafsirEntry(entry);
      setLoading(false);

      if (chapter) {
        scheduleTafsirPrefetch({
          dataUsageMode: prefs.dataUsageMode,
          activeTafsirId: activeTafsir,
          surahId,
          ayahId,
          surahAyahCount: chapter.versesCount,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // Warm the verse-to-page map so ArabicVerseBlock can resolve glyph fonts
  // without a cold fetch on first render.
  useMountEffect(() => {
    fetchVersePages(prefs.mushafCode).catch(() => {});
  });

  const navigatePrev = useCallback(() => {
    if (ayahId > 1) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId - 1));
      return;
    }
    const prev = chapters.find((c) => c.id === surahId - 1);
    if (prev) router.push(tafsirPath(activeTafsir, prev.id, prev.versesCount));
  }, [router, activeTafsir, surahId, ayahId, chapters]);

  const navigateNext = useCallback(() => {
    if (chapter && ayahId < chapter.versesCount) {
      router.push(tafsirPath(activeTafsir, surahId, ayahId + 1));
      return;
    }
    if (surahId < 114) {
      router.push(tafsirPath(activeTafsir, surahId + 1, 1));
    }
  }, [router, activeTafsir, surahId, ayahId, chapter]);

  // Keyboard arrows — RTL-aware. Right arrow → previous, left → next.
  useMountEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigatePrev();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const availableIds = useMemo<readonly TafsirId[] | null>(
    () => getAvailableTafsirIds(availability, surahId, ayahId),
    [availability, surahId, ayahId],
  );

  const handleTafsirSwitch = useCallback(
    async (next: TafsirId) => {
      if (next === activeTafsir) return;
      setPendingTafsir(next);
      setActiveTafsir(next);
      setTafsirEntry(null);
      setLoading(true);

      const entry = await loadTafsirEntry(next, surahId, ayahId);
      setTafsirEntry(entry);
      setLoading(false);
      setPendingTafsir(null);

      // Keep the page mounted — just reflect the new tafsir in the URL.
      window.history.replaceState(null, "", tafsirPath(next, surahId, ayahId));

      if (chapter) {
        scheduleTafsirPrefetch({
          dataUsageMode: prefs.dataUsageMode,
          activeTafsirId: next,
          surahId,
          ayahId,
          surahAyahCount: chapter.versesCount,
        });
      }
    },
    [activeTafsir, surahId, ayahId, chapter, prefs.dataUsageMode],
  );

  const canGoPrev = ayahId > 1 || surahId > 1;
  const canGoNext = chapter ? ayahId < chapter.versesCount || surahId < 114 : false;

  const rangeLabel = useMemo(() => {
    if (!tafsirEntry?.ayahsStart || !tafsirEntry?.count || tafsirEntry.count <= 1) return null;
    const start = tafsirEntry.ayahsStart;
    const end = start + tafsirEntry.count - 1;
    return `${surahId}:${start}–${end}`;
  }, [tafsirEntry, surahId]);

  const attributionUrl = `https://tafsir.app/${activeTafsir}/${surahId}/${ayahId}`;

  const handleWordTap = useCallback((target: WordTapTarget) => {
    setSelectedTap(target);
  }, []);

  return (
    <main className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]">
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 animate-fade-in">
          {ayahId === 1 && chapter && (
            <div className="mb-6">
              <SurahHeader
                nameSimple={chapter.nameSimple}
                surahNumber={chapter.id}
                variant="viewer"
                showBismillah={
                  !!chapter.bismillahPre && chapter.id !== 1 && chapter.id !== 9
                }
              />
            </div>
          )}

          <section className="mb-6 rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-5 pb-5 pt-4">
            <header className="mb-3 flex items-center justify-between">
              <a
                href={vbvPath("s", surahId, verseKey)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)] tabular-nums hover:text-[var(--color-accent)] transition-colors"
                aria-label={`Open ${verseKey} in reader`}
              >
                <span>{chapter?.nameSimple}</span>
                <span aria-hidden>·</span>
                <span>{verseKey}</span>
              </a>
              <span className="font-arabic text-sm text-[var(--color-muted)]" dir="rtl">
                {chapter?.nameArabic}
              </span>
            </header>

            <ArabicVerseBlock
              verseKey={verseKey}
              mushafCode={prefs.mushafCode}
              onWordTap={handleWordTap}
              fontScale={prefs.fontScale ?? 1}
              label={verseKey}
              compact
            />
          </section>

          <div className="mb-4">
            <TafsirSwitcher
              active={activeTafsir}
              onChange={handleTafsirSwitch}
              available={availableIds}
              pending={pendingTafsir}
            />
          </div>

          <article className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5">
            <header className="mb-3 flex items-center justify-between gap-2">
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
            </header>

            {rangeLabel && (
              <div className="mb-3 text-xs text-[var(--color-muted)]">
                Covers ayaat {rangeLabel}
              </div>
            )}

            {loading ? (
              <TafsirSkeleton />
            ) : tafsirEntry?.text ? (
              <TafsirContent html={tafsirEntry.text} />
            ) : (
              <p className="py-4 text-center text-sm text-[var(--color-muted)]">
                No tafsir available for this ayah.
              </p>
            )}
          </article>
        </div>
      </div>

      <ReaderBottomNav
        showBack
        visible
        centerClassName="gap-2"
        centerLabel={{
          icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />,
          text: verseKey,
          ariaLabel: `Verse ${verseKey} — open navigation`,
          onClick: () => setPickerOpen(true),
          size: "sm",
        }}
        centerExtra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={navigatePrev}
              disabled={!canGoPrev}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
              aria-label="Previous ayah"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={navigateNext}
              disabled={!canGoNext}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
              aria-label="Next ayah"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        }
        showModeToggle={false}
        showRecitation={false}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <WordTapSheets
        selectedTap={selectedTap}
        translationIds={prefs.translationIds}
        mushafCode={prefs.mushafCode}
        onRetargetTap={setSelectedTap}
        onClose={() => setSelectedTap(null)}
      />

      <NavigationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialPage={null}
        initialVerseKey={verseKey}
        onNavigate={(_page, nextVerseKey) => {
          setPickerOpen(false);
          if (!nextVerseKey) return;
          const [sPart, aPart] = nextVerseKey.split(":");
          const sNum = Number.parseInt(sPart, 10);
          const aNum = Number.parseInt(aPart, 10);
          if (!Number.isFinite(sNum) || !Number.isFinite(aNum)) return;
          router.push(tafsirPath(activeTafsir, sNum, aNum));
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}

function TafsirSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-4/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
      <div className="h-4 w-3/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
    </div>
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
