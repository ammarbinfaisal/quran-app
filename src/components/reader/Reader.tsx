"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { TOTAL_PAGES } from "@/lib/constants";
import { usePreferences } from "@/hooks/usePreferences";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import SwipeReader from "@/components/mushaf/SwipeReader";

import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { useRouter, useSearchParams } from "next/navigation";
import { mushafPath } from "@/lib/url";
import { shareUrl } from "@/lib/share";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { trackPageDebounced } from "@/hooks/useReadingHistory";
import { useMountEffect } from "@/hooks/useMountEffect";
import { removeQueryParamFromCurrentUrl } from "@/lib/urlSearchParams";
import type { WordTapTarget } from "@/lib/wordTap";
import { useChapters } from "@/hooks/useChapters";
import { pageToSurah, pageToJuz } from "@/lib/navigation/maps";
import { useReaderDataPrefetch } from "@/hooks/useReaderDataPrefetch";
import { useRecitationContext } from "@/components/recitation/RecitationContext";

function clampPage(p: number) {
  return Math.max(1, Math.min(TOTAL_PAGES, p));
}

export function Reader({ initialPage }: { initialPage: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verseParam = searchParams.get("verse");
  const { prefs } = usePreferences();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } =
    useImmersiveMode();

  const [page, setPage] = useState(initialPage);
  const [dismissedVerse, setDismissedVerse] = useState<string | null>(null);
  const highlightedVerse =
    verseParam && dismissedVerse === verseParam ? null : verseParam;

  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);

  const mushafCode = prefs.mushafCode;

  const chapters = useChapters();
  const { setContext } = useRecitationContext();

  const surahId = useMemo(() => {
    if (!chapters.length) return undefined;
    return pageToSurah(page, chapters);
  }, [page, chapters]);

  const juzId = useMemo(() => pageToJuz(page), [page]);

  const surahName = useMemo(() => {
    if (!chapters.length) return String(page);
    return chapters.find(c => c.id === surahId)?.nameSimple ?? String(page);
  }, [surahId, chapters, page]);

  // Update recitation context after render when page/surah/juz change
  useLayoutEffect(() => {
    setContext({ currentPage: page, currentSurahId: surahId, currentJuzId: juzId });
  }, [page, surahId, juzId, setContext]);

  // Set initial context on mount
  useMountEffect(() => {
    setContext({ currentPage: page, currentSurahId: surahId, currentJuzId: juzId });
  });

  // --- Track reading: initial + on page change ---
  useMountEffect(() => {
    trackPageDebounced(page);
  });

  const replaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePageChange = useCallback(
    (next: number) => {
      const p = clampPage(next);
      setPage(p);
      trackPageDebounced(p);

      if (replaceTimer.current) clearTimeout(replaceTimer.current);
      replaceTimer.current = setTimeout(() => {
        // Pure address-bar update: window.history.replaceState swaps the URL
        // without re-running the App Router segment, so the swipe (which has
        // ALREADY rendered the new page from prefetched data) is not undone
        // by a full route navigation that would refetch and re-render.
        // router.replace was triggering an unnecessary segment refresh on
        // every swipe, causing visible re-mount and a brief skeleton flash.
        window.history.replaceState(null, "", mushafPath(p, null));
      }, 150);
    },
    [],
  );

  // Cleanup replaceTimer on unmount
  useMountEffect(() => {
    return () => {
      if (replaceTimer.current) clearTimeout(replaceTimer.current);
    };
  });

  // Apply theme and font scale via preferences listener
  useApplyPreferences();

  // Expose showChrome for Playwright tests
  const showChromeRef = useRef(showChrome);

  useLayoutEffect(() => {
    showChromeRef.current = showChrome;
  });

  useMountEffect(() => {
    const w = window as unknown as { __showChrome?: () => void };
    w.__showChrome = () => showChromeRef.current();
    return () => {
      delete w.__showChrome;
    };
  });

  // Save reading mode preference when entering mushaf view
  useMountEffect(() => {
    setPreference("viewMode", "mushaf");
  });

  useReaderDataPrefetch({
    mushafCode,
    dataUsageMode: prefs.dataUsageMode,
    translationIds: prefs.translationIds,
    scopeType: "p",
    focusPage: page,
    scopePages: [page],
    tafsirOrder: prefs.tafsirOrder,
  });

  const handleWordTap = useCallback(
    (target: WordTapTarget) => {
      const resolvedIndex = target.wordIndex;
      devLog(
        "Reader",
        "word tap",
        target.verseKey,
        "morphIndex:",
        resolvedIndex ?? "→ translation",
      );
      setSelectedTap(target);
      showChrome();
    },
    [showChrome],
  );

  const clearHighlightedVerse = useCallback(() => {
    if (!highlightedVerse) return;
    setDismissedVerse(highlightedVerse);
    removeQueryParamFromCurrentUrl("verse");
    queueMicrotask(() => setDismissedVerse(null));
  }, [highlightedVerse]);

  const handleShare = useCallback(() => {
    void shareUrl(mushafPath(page, highlightedVerse ?? null));
  }, [page, highlightedVerse]);

  const ReaderComponent = SwipeReader;

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="flex h-full w-full flex-col">
        {/* Reading area — tap to toggle chrome */}
        <div
          id="reader-background"
          className="min-h-0 flex-1"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button, a")) {
              toggleChrome();
            }
          }}
        >
          <ReaderComponent
            currentPage={page}
            mushafCode={mushafCode}
            onPageChange={handlePageChange}
            onWordTap={handleWordTap}
            highlightedVerse={highlightedVerse}
            onInteractionStart={clearHighlightedVerse}
          />
        </div>

        <ReaderBottomNav
          visible={chromeVisible}
          onHomeClick={resetTimer}
          centerLabel={{
            icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)] transition-colors" />,
            text: surahName,
            ariaLabel: "Open navigation",
            onClick: () => {
              setSurahOpen(true);
              showChrome();
            },
          }}
          onSettingsClick={() => {
            setSettingsOpen(true);
            showChrome();
          }}
          showShare
          onShareClick={handleShare}
        />
      </div>

      <WordTapSheets
        selectedTap={selectedTap}
        translationIds={prefs.translationIds}
        mushafCode={mushafCode}
        onRetargetTap={setSelectedTap}
        onClose={() => {
          setSelectedTap(null);
        }}
      />

      <NavigationPicker
        open={surahOpen}
        onClose={() => setSurahOpen(false)}
        initialPage={page}
        initialVerseKey={highlightedVerse}
        onNavigate={(nextPage, verseKey) => {
          router.push(mushafPath(clampPage(nextPage), verseKey), { scroll: false });
          setSelectedTap(null);
          setSurahOpen(false);
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
