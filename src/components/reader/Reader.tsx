"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Home, Settings, BookOpen, Download } from "lucide-react";
import { TOTAL_PAGES } from "@/lib/constants";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import SwipeReader from "@/components/mushaf/SwipeReader";
import { ModeToggle } from "@/components/navigation/ModeToggle";

import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { useRouter, useSearchParams } from "next/navigation";
import { mushafPath } from "@/lib/url";

function clampPage(p: number) {
  return Math.max(1, Math.min(TOTAL_PAGES, p));
}

export function Reader({ initialPage }: { initialPage: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedVerse = searchParams.get("verse");
  const { prefs } = usePreferences();
  const { applyTheme } = useTheme();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } =
    useImmersiveMode();

  const [page, setPage] = useState(initialPage);
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const mushafCode = prefs.mushafCode;
  
  useEffect(() => {
      setPage(initialPage);
    }, [initialPage]);
  
  const replaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handlePageChange = useCallback((next: number) => {
    const p = clampPage(next);
    setPage(p);
  
    if (replaceTimer.current) clearTimeout(replaceTimer.current);
    replaceTimer.current = setTimeout(() => {
      router.replace(mushafPath(p, null), { scroll: false });
    }, 150);
  }, [router]);
  
  useEffect(() => () => {
    if (replaceTimer.current) clearTimeout(replaceTimer.current);
  }, []);

  useEffect(() => {
    applyTheme(prefs.theme);
    document.documentElement.style.setProperty(
      "--mushaf-font-scale",
      String(prefs.fontScale),
    );
  }, [applyTheme, prefs.fontScale, prefs.theme]);

  // Idempotent helper specifically for Playwright tests
  useEffect(() => {
    const w = window as unknown as { __showChrome?: () => void };
    w.__showChrome = showChrome;
    return () => {
      delete w.__showChrome;
    };
  }, [showChrome]);

  // Save reading mode preference when entering mushaf view
  useEffect(() => {
    setPreference("viewMode", "mushaf");
  }, []);

  const handleWordTap = useCallback(
    (verseKey: string, wordIndex: number) => {
      // wordIndex === -1 means end marker / non-word → open translation sheet
      // wordIndex >= 0 means real word → open morphology sheet
      const resolvedIndex = wordIndex >= 0 ? wordIndex : null;
      devLog(
        "Reader",
        "word tap",
        verseKey,
        "morphIndex:",
        resolvedIndex ?? "→ translation",
      );
      setSelectedVerse(verseKey);
      setSelectedWordIndex(resolvedIndex);
      showChrome();
    },
    [showChrome],
  );

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
          />
        </div>

        {/* Bottom nav — fixed at bottom, auto-hide/show */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm px-2 transition-transform duration-300 ease-in-out"
          style={{
            transform: chromeVisible ? "translateY(0)" : "translateY(100%)",
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          }}
        >
          {/* Left: Home */}
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Home"
            onClick={resetTimer}
          >
            <Home className="h-5 w-5" />
          </Link>

          {/* Center: Page indicator + Surah picker trigger AND Mode Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSurahOpen(true);
                showChrome();
              }}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-[var(--color-text)] active:scale-[0.97] active:opacity-80"
            >
              <BookOpen className="h-4 w-4 text-[var(--color-muted)] transition-colors" />
              <span className="tabular-nums font-medium">{page}</span>
            </button>
            <ModeToggle />
          </div>

          {/* Right: Downloads + Offline + Settings */}
          <div className="flex items-center">
            <OfflineIndicator />
            <button
              type="button"
              onClick={() => {
                setDownloadsOpen(true);
                showChrome();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
              aria-label="Manage downloads"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                showChrome();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </div>

      <AyahSheet
        open={!!selectedVerse && selectedWordIndex === null}
        verseKey={selectedVerse}
        translationIds={prefs.translationIds}
        onClose={() => setSelectedVerse(null)}
      />

      <MorphologySheet
        open={!!selectedVerse && selectedWordIndex !== null}
        verseKey={selectedVerse}
        wordIndex={selectedWordIndex}
        mushafCode={mushafCode}
        onClose={() => {
          setSelectedVerse(null);
          setSelectedWordIndex(null);
        }}
      />

      <NavigationPicker
        open={surahOpen}
        onClose={() => setSurahOpen(false)}
        onNavigate={(nextPage, verseKey) => {
          router.push(mushafPath(clampPage(nextPage), verseKey), { scroll: false });
          setSelectedVerse(null);
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
