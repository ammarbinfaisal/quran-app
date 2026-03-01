"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { useTrackReading } from "@/hooks/useReadingHistory";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { VbvSubmodeToggle } from "@/components/navigation/VbvSubmodeToggle";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { VerseByVerseViewer } from "@/components/mushaf/VerseByVerseViewer";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { vbvPath, indopakVbvPath } from "@/lib/url";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";

export function VerseReader({
  type,
  id,
  forcedMushafCode,
}: {
  type: "p" | "s" | "j";
  id: number;
  forcedMushafCode?: import("@/lib/types").MushafCode;
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

  const mushafCode = forcedMushafCode ?? prefs.mushafCode;
  const navPath = mushafCode === "indopak" ? indopakVbvPath : vbvPath;

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
  if (type === "p") label = `Page ${id}`;

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
              router.push(navPath(newType, newId), { scroll: false });
            }}
          />
        </div>
      </div>

      <ReaderBottomNav
        visible={chromeVisible}
        onHomeClick={resetTimer}
        centerClassName="gap-2"
        centerLabel={{
          icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />,
          text: label,
          ariaLabel: "Open navigation",
          onClick: () => {
            setSurahOpen(true);
            showChrome();
          },
          size: "sm",
        }}
        centerExtra={
          <VbvSubmodeToggle
            currentType={type}
            currentId={id}
            onNavigate={(newType, newId, verse) => {
              setHighlightedVerse(verse ?? null);
              router.push(navPath(newType, newId, verse ?? undefined), { scroll: false });
            }}
          />
        }
        onDownloadsClick={() => {
          setDownloadsOpen(true);
          showChrome();
        }}
        onSettingsClick={() => {
          setSettingsOpen(true);
          showChrome();
        }}
      />

      <WordTapSheets
        selectedVerse={selectedVerse}
        selectedWordIndex={selectedWordIndex}
        translationIds={prefs.translationIds}
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
          router.push(navPath("p", page, verseKey ?? undefined), { scroll: false });
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
