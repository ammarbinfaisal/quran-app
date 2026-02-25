"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { ScrollSubmodeToggle } from "@/components/navigation/ScrollSubmodeToggle";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { DownloadManager } from "@/components/offline/DownloadManager";
import ScrollReader from "@/components/mushaf/ScrollReader";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { scrollPath } from "@/lib/url";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";

export function ScrollModeReader({
  type,
  id,
}: {
  type: "p" | "s" | "j";
  id: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { prefs } = usePreferences();
  const { applyTheme } = useTheme();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } = useImmersiveMode();

  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const highlightedVerse = searchParams.get("verse");

  useEffect(() => {
    setPreference("viewMode", "scroll");
  }, []);

  useEffect(() => {
    setPreference("scrollSubmode", type);
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
      "ScrollModeReader",
      "word tap",
      verseKey,
      "morphIndex:",
      resolvedIndex ?? "→ translation",
    );
    setSelectedVerse(verseKey);
    setSelectedWordIndex(resolvedIndex);
  }, []);

  const label = useMemo(() => {
    if (type === "s") return `Surah ${id}`;
    if (type === "j") return `Juz ${id}`;
    return `Page ${id}`;
  }, [id, type]);

  return (
    <main className="h-full w-full overflow-hidden flex flex-col">
      <div
        className="scroll-container flex-1 min-h-0 bg-[var(--color-bg)]"
        data-scroll-reader
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button, a")) {
            toggleChrome();
          }
        }}
      >
        <div key={`${type}:${id}`} className="animate-fade-in">
          <ScrollReader
            type={type}
            id={id}
            mushafCode={prefs.mushafCode}
            onWordTap={handleWordTap}
            highlightedVerse={highlightedVerse}
            onNavigate={(newType, newId) => {
              router.push(scrollPath(newType, newId), { scroll: false });
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
        centerExtra={(
          <ScrollSubmodeToggle
            currentType={type}
            currentId={id}
            onNavigate={(newType, newId, verse) => {
              router.push(scrollPath(newType, newId, verse ?? undefined), { scroll: false });
            }}
          />
        )}
        onDownloadsClick={() => {
          setDownloadsOpen(true);
          showChrome();
        }}
        onSettingsClick={() => {
          setSettingsOpen(true);
          showChrome();
        }}
      />

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
        mushafCode={prefs.mushafCode}
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
          router.push(scrollPath("p", page, verseKey ?? undefined), { scroll: false });
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
