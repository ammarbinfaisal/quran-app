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
import { DownloadManager } from "@/components/offline/DownloadManager";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { useRouter, useSearchParams } from "next/navigation";
import { mushafPath } from "@/lib/url";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { trackPageDebounced } from "@/hooks/useReadingHistory";
import { useMountEffect } from "@/hooks/useMountEffect";
import { removeQueryParamFromCurrentUrl } from "@/lib/urlSearchParams";
import type { WordTapTarget } from "@/lib/wordTap";
import { useChapters } from "@/hooks/useChapters";
import { pageToSurah } from "@/lib/navigation/maps";
import { useReaderDataPrefetch } from "@/hooks/useReaderDataPrefetch";

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
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const mushafCode = prefs.mushafCode;

  const chapters = useChapters();
  const surahName = useMemo(() => {
    if (!chapters.length) return String(page);
    const surahId = pageToSurah(page, chapters);
    return chapters.find(c => c.id === surahId)?.nameSimple ?? String(page);
  }, [page, chapters]);

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
        router.replace(mushafPath(p, null), { scroll: false });
      }, 150);
    },
    [router],
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
          onDownloadsClick={() => {
            setDownloadsOpen(true);
            showChrome();
          }}
          onSettingsClick={() => {
            setSettingsOpen(true);
            showChrome();
          }}
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
      <DownloadManager
        open={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
      />
    </main>
  );
}
