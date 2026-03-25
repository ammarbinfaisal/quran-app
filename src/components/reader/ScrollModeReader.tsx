"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { ScrollSubmodeToggle } from "@/components/navigation/ScrollSubmodeToggle";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { DownloadManager } from "@/components/offline/DownloadManager";
import ScrollReader from "@/components/mushaf/ScrollReader";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { scrollPath } from "@/lib/url";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { useMountEffect } from "@/hooks/useMountEffect";
import { removeQueryParamFromCurrentUrl } from "@/lib/urlSearchParams";
import type { WordTapTarget } from "@/lib/wordTap";

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
  const { chromeVisible, toggleChrome, showChrome, resetTimer } = useImmersiveMode();

  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const verseParam = searchParams.get("verse");
  const [dismissedVerse, setDismissedVerse] = useState<string | null>(null);
  const highlightedVerse =
    verseParam && dismissedVerse === verseParam ? null : verseParam;

  // Save reading mode + submode preferences on mount
  useMountEffect(() => {
    setPreference("viewMode", "scroll");
    setPreference("scrollSubmode", type);
  });

  // Apply theme and font scale via preferences listener
  useApplyPreferences();

  const handleWordTap = useCallback((target: WordTapTarget) => {
    const resolvedIndex = target.wordIndex;
    devLog(
      "ScrollModeReader",
      "word tap",
      target.verseKey,
      "morphIndex:",
      resolvedIndex ?? "→ translation",
    );
    setSelectedTap(target);
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
        onScroll={() => {
          if (!verseParam) return;
          if (dismissedVerse === verseParam) return;
          setDismissedVerse(verseParam);
          removeQueryParamFromCurrentUrl("verse");
          queueMicrotask(() => setDismissedVerse(null));
        }}
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
              setDismissedVerse(verse ?? null);
              router.push(scrollPath(newType, newId, verse ?? undefined), { scroll: false });
              queueMicrotask(() => setDismissedVerse(null));
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

      <WordTapSheets
        selectedTap={selectedTap}
        translationIds={prefs.translationIds}
        mushafCode={prefs.mushafCode}
        onClose={() => {
          setSelectedTap(null);
        }}
      />

      <NavigationPicker
        open={surahOpen}
        onClose={() => setSurahOpen(false)}
        onNavigate={(page: number, verseKey: string | null) => {
          setSelectedTap(null);
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
