"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Settings, BookOpen, Download } from "lucide-react";
import type { MushafCode } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useShallowUrl } from "@/hooks/useShallowUrl";
import { useTrackReading } from "@/hooks/useReadingHistory";
import SwipeReader from "@/components/mushaf/SwipeReader";
import ScrollReader from "@/components/mushaf/ScrollReader";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import SurahPicker from "@/components/nav/SurahPicker";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";

export function Reader({
  initialPage,
  initialMushaf,
  initialHighlightedVerse,
}: {
  initialPage: number;
  initialMushaf: MushafCode;
  initialHighlightedVerse: string | null;
}) {
  const { prefs, setPref } = usePreferences();
  const { applyTheme } = useTheme();

  const [page, setPage] = useState(initialPage);
  const [highlightedVerse, setHighlightedVerse] = useState<string | null>(
    initialHighlightedVerse,
  );
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const mushafCode = prefs.mushafCode;

  useEffect(() => {
    applyTheme(prefs.theme);
    document.documentElement.style.setProperty(
      "--mushaf-font-scale",
      String(prefs.fontScale),
    );
  }, [applyTheme, prefs.fontScale, prefs.theme]);

  useEffect(() => {
    if (prefs.mushafCode !== initialMushaf) {
      setPref("mushafCode", initialMushaf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMushaf]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    setHighlightedVerse(initialHighlightedVerse);
  }, [initialHighlightedVerse]);

  useShallowUrl(page, mushafCode, highlightedVerse);
  useTrackReading(page);

  const clampPage = useCallback((p: number) => {
    return Math.max(1, Math.min(TOTAL_PAGES, p));
  }, []);

  const handlePageChange = useCallback(
    (next: number) => {
      const clamped = clampPage(next);
      setPage(clamped);
      setHighlightedVerse(null);
    },
    [clampPage],
  );

  const handleWordTap = useCallback((verseKey: string) => {
    setSelectedVerse(verseKey);
    setHighlightedVerse(verseKey);
  }, []);

  const reader = useMemo(() => {
    if (prefs.readingMode === "scroll") {
      return (
        <ScrollReader
          currentPage={page}
          mushafCode={mushafCode}
          onPageChange={handlePageChange}
          onWordTap={handleWordTap}
          highlightedVerse={highlightedVerse}
        />
      );
    }

    return (
      <SwipeReader
        currentPage={page}
        mushafCode={mushafCode}
        onPageChange={handlePageChange}
        onWordTap={handleWordTap}
        highlightedVerse={highlightedVerse}
      />
    );
  }, [
    handlePageChange,
    handleWordTap,
    highlightedVerse,
    mushafCode,
    page,
    prefs.readingMode,
  ]);

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="flex h-full w-full flex-col">
        <header className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <a
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)]"
              aria-label="Home"
            >
              <Home className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setSurahOpen(true)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)]"
            >
              <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />
              <span className="tabular-nums">{page}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <OfflineIndicator />
            <button
              type="button"
              onClick={() => setDownloadsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)]"
              aria-label="Manage downloads"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)]"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1">{reader}</div>
      </div>

      <AyahSheet
        open={!!selectedVerse}
        verseKey={selectedVerse}
        translationId={prefs.translationId}
        onClose={() => setSelectedVerse(null)}
      />

      <SurahPicker
        open={surahOpen}
        onClose={() => setSurahOpen(false)}
        onNavigate={(nextPage, verseKey) => {
          setPage(clampPage(nextPage));
          setHighlightedVerse(verseKey);
          setSelectedVerse(null);
          setSurahOpen(false);
        }}
      />

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DownloadManager open={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
    </main>
  );
}
