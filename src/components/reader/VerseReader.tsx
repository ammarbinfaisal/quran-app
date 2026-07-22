"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { useMountEffect } from "@/hooks/useMountEffect";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { VbvSubmodeToggle } from "@/components/navigation/VbvSubmodeToggle";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import { VerseByVerseViewer } from "@/components/mushaf/VerseByVerseViewer";
import { setPreference } from "@/lib/preferences";
import { devLog } from "@/lib/devLog";
import { vbvPath } from "@/lib/url";
import { shareUrl } from "@/lib/share";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import type { WordTapTarget } from "@/lib/wordTap";
import { useDirectionalReaderKeyboardNav } from "@/hooks/useDirectionalReaderKeyboardNav";
import { useReaderPosition } from "@/hooks/useReaderPosition";

export function VerseReader({
  type,
  id,
}: {
  type: "p" | "s" | "j";
  id: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verseParam = searchParams.get("verse");
  const { prefs } = usePreferences();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } =
    useImmersiveMode();

  const [dismissedVerse, setDismissedVerse] = useState<string | null>(null);
  const highlightedVerse =
    verseParam && dismissedVerse === verseParam ? null : verseParam;

  const mushafCode = prefs.mushafCode;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [navSelection, setNavSelection] = useState<{
    page: number | null;
    verseKey: string | null;
  }>({
    page: type === "p" ? id : null,
    verseKey: verseParam,
  });

  const { focusPage, label, getNavSelection, handleScrollPosition } =
    useReaderPosition({
      type,
      id,
      scrollContainerRef,
      fallbackVerseKey: verseParam,
      trackHistory: true,
    });

  // Save reading mode + submode preferences on mount
  useMountEffect(() => {
    setPreference("viewMode", "vbv");
    setPreference("vbvSubmode", type);
  });

  // Apply theme and font scale via preferences listener
  useApplyPreferences();

  useDirectionalReaderKeyboardNav({
    type,
    id,
    onNavigate: (nextType, nextId) => {
      router.push(vbvPath(nextType, nextId), { scroll: false });
    },
  });

  const handleWordTap = useCallback((target: WordTapTarget) => {
    const resolvedIndex = target.wordIndex;
    devLog(
      "VerseReader",
      "word tap",
      target.verseKey,
      "morphIndex:",
      resolvedIndex ?? "→ translation",
    );
    setSelectedTap(target);
    if (verseParam) {
      setDismissedVerse(verseParam);
      queueMicrotask(() => setDismissedVerse(null));
    }
  }, [verseParam]);

  const handleShare = useCallback(() => {
    void shareUrl(vbvPath(type, id, highlightedVerse ?? undefined));
  }, [type, id, highlightedVerse]);

  return (
    <main className="h-full w-full overflow-hidden flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]"
        data-vbv-scroll
        onScroll={() => {
          handleScrollPosition();
        }}
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
            focusPage={focusPage}
            onNavigate={(newType, newId) => {
              if (verseParam) {
                setDismissedVerse(verseParam);
                queueMicrotask(() => setDismissedVerse(null));
              }
              router.push(vbvPath(newType, newId), { scroll: false });
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
            setNavSelection(getNavSelection());
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
              setDismissedVerse(verse ?? null);
              router.push(vbvPath(newType, newId, verse ?? undefined), { scroll: false });
              queueMicrotask(() => setDismissedVerse(null));
            }}
          />
        }
        onSettingsClick={() => {
          setSettingsOpen(true);
          showChrome();
        }}
        showShare
        onShareClick={handleShare}
      />

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
        initialPage={navSelection.page}
        initialVerseKey={navSelection.verseKey}
        onNavigate={(page: number, verseKey: string | null) => {
          setSelectedTap(null);
          setSurahOpen(false);
          router.push(vbvPath("p", page, verseKey ?? undefined), { scroll: false });
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
