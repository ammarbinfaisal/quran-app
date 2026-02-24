"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { BookOpen } from "lucide-react";
import { TOTAL_PAGES } from "@/lib/constants";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import SwipeReader from "@/components/mushaf/SwipeReader";

import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { purgeOrphanedMushafPages } from "@/lib/mushaf/loader";
import { useRouter, useSearchParams } from "next/navigation";
import { mushafPath } from "@/lib/url";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";

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
    void purgeOrphanedMushafPages();
  }, []);

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

        <ReaderBottomNav
          visible={chromeVisible}
          onHomeClick={resetTimer}
          centerLabel={{
            icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)] transition-colors" />,
            text: page,
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
