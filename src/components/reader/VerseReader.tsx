"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Settings, BookOpen, Download } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { useTrackReading } from "@/hooks/useReadingHistory";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { ModeToggle } from "@/components/navigation/ModeToggle";
import { VbvSubmodeToggle } from "@/components/navigation/VbvSubmodeToggle";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { VerseByVerseViewer } from "@/components/mushaf/VerseByVerseViewer";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { vbvPath } from "@/lib/url";

export function VerseReader({
  type,
  id,
}: {
  type: "p" | "s" | "j";
  id: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialHighlightedVerse = searchParams.get("verse");
  const { prefs } = usePreferences();
  const { applyTheme } = useTheme();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } =
    useImmersiveMode();

  const [highlightedVerse, setHighlightedVerse] = useState<string | null>();

  useEffect(() => {
    // run once on mount
    setHighlightedVerse(initialHighlightedVerse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mushafCode = prefs.mushafCode;

  useTrackReading(type === "p" ? id : 1);
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  // Save reading mode + submode preferences
  useEffect(() => {
    setPreference("viewMode", "vbv");
  }, []);

  useEffect(() => {
    setPreference("vbvSubmode", type);
  }, [type]);

  useEffect(() => {
    applyTheme(prefs.theme);
    document.documentElement.style.setProperty(
      "--mushaf-font-scale",
      String(prefs.fontScale),
    );
  }, [applyTheme, prefs.fontScale, prefs.theme]);

  const handleWordTap = useCallback((verseKey: string, wordIndex: number) => {
    const resolvedIndex = wordIndex >= 0 ? wordIndex : null;
    devLog(
      "VerseReader",
      "word tap",
      verseKey,
      "morphIndex:",
      resolvedIndex ?? "→ translation",
    );
    setSelectedVerse(verseKey);
    setSelectedWordIndex(resolvedIndex);
    setHighlightedVerse(null);
  }, []);

  let label = String(id);
  if (type === "s") label = `Surah ${id}`;
  if (type === "j") label = `Juz ${id}`;

  return (
    <main className="h-full w-full overflow-hidden flex flex-col">
      <div
        className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]"
        data-vbv-scroll
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button, a")) {
            toggleChrome();
          }
        }}
      >
        <div key={`${type}:${id}`} className="animate-fade-in">
          <VerseByVerseViewer
            type={type}
            id={id}
            mushafCode={mushafCode}
            onWordTap={handleWordTap}
            highlightedVerse={highlightedVerse}
            onNavigate={(newType, newId) => {
              setHighlightedVerse(null);
              router.push(vbvPath(newType, newId), { scroll: false });
            }}
          />
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm px-2 transition-transform duration-300 ease-in-out"
        style={{
          transform: chromeVisible ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
      >
        <Link
          href="/"
          className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
          onClick={resetTimer}
        >
          <Home className="h-5 w-5" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSurahOpen(true);
              showChrome();
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-[var(--color-text)] active:scale-[0.97] active:opacity-80"
          >
            <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />
            <span className="font-medium tabular-nums">{label}</span>
          </button>
          <VbvSubmodeToggle
            currentType={type}
            currentId={id}
            onNavigate={(newType, newId, verse) => {
              setHighlightedVerse(verse ?? null);
              router.push(vbvPath(newType, newId, verse ?? undefined), { scroll: false });
            }}
          />
          <ModeToggle />
        </div>

        <div className="flex items-center">
          <OfflineIndicator />
          <button
            type="button"
            onClick={() => {
              setDownloadsOpen(true);
              showChrome();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)]"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              showChrome();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)]"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </nav>

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
        onNavigate={(page: number, verseKey: string | null) => {
          setSelectedVerse(null);
          setSurahOpen(false);
          router.push(vbvPath("p", page, verseKey ?? undefined), { scroll: false });
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
