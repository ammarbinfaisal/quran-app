"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { trackPageDebounced } from "@/hooks/useReadingHistory";
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
import { getFirstFullyVisiblePage, getFirstFullyVisibleVerse } from "@/lib/viewport";
import { useDirectionalReaderKeyboardNav } from "@/hooks/useDirectionalReaderKeyboardNav";
import { useChapters } from "@/hooks/useChapters";
import { pageToSurah, pageToJuz } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { useRecitationContext } from "@/components/recitation/RecitationContext";

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
  const chapters = useChapters();
  const { chromeVisible, toggleChrome, showChrome, resetTimer } =
    useImmersiveMode();

  const [dismissedVerse, setDismissedVerse] = useState<string | null>(null);
  const highlightedVerse =
    verseParam && dismissedVerse === verseParam ? null : verseParam;

  const mushafCode = prefs.mushafCode;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTrackedPageRef = useRef<number | null>(null);

  // Track reading on mount — derive the actual first page for s/j types
  useMountEffect(() => {
    let page: number | null = null;
    if (type === "p") {
      page = id;
    } else if (type === "s") {
      page = chapters.find((c) => c.id === id)?.pages[0] ?? null;
    } else {
      page = JUZ_PAGE_RANGES.find((r) => r.juz === id)?.pages[0] ?? null;
    }
    if (page !== null) {
      lastTrackedPageRef.current = page;
      trackPageDebounced(page);
    }
  });

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
  const [focusPage, setFocusPage] = useState<number | null>(type === "p" ? id : null);

  // Reset focusPage when navigating to a different scope so the recitation
  // context (and any other labelPage consumers) immediately reflect the new
  // view instead of holding the previously scrolled page.
  const currentScopeKey = `${type}:${id}`;
  const [lastScopeKey, setLastScopeKey] = useState(currentScopeKey);
  if (lastScopeKey !== currentScopeKey) {
    setLastScopeKey(currentScopeKey);
    setFocusPage(type === "p" ? id : null);
  }

  const handleScrollFocusPage = useCallback(
    (nextPage: number | null) => {
      setFocusPage(nextPage);
      if (nextPage !== null && nextPage !== lastTrackedPageRef.current) {
        lastTrackedPageRef.current = nextPage;
        trackPageDebounced(nextPage);
      }
    },
    [],
  );

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

  const labelPage = useMemo(() => {
    if (focusPage !== null) return focusPage;
    if (type === "p") return id;
    if (type === "s") return chapters.find((chapter) => chapter.id === id)?.pages[0] ?? null;
    return JUZ_PAGE_RANGES.find((range) => range.juz === id)?.pages[0] ?? null;
  }, [chapters, focusPage, id, type]);

  const label = useMemo(() => {
    if (!chapters.length || labelPage === null) return String(id);
    const surahId = pageToSurah(labelPage, chapters);
    return chapters.find((chapter) => chapter.id === surahId)?.nameSimple ?? String(id);
  }, [chapters, id, labelPage]);

  // Keep the recitation player in sync with the current view so the range
  // picker has sensible defaults when the player sheet opens.
  const { setContext } = useRecitationContext();
  const recitationContextSurahId = useMemo(() => {
    if (!chapters.length || labelPage === null) return undefined;
    return pageToSurah(labelPage, chapters);
  }, [chapters, labelPage]);
  const recitationContextJuzId = useMemo(() => {
    if (labelPage === null) return undefined;
    return pageToJuz(labelPage);
  }, [labelPage]);
  useLayoutEffect(() => {
    setContext({
      currentPage: labelPage ?? undefined,
      currentSurahId: recitationContextSurahId,
      currentJuzId: recitationContextJuzId,
    });
  }, [labelPage, recitationContextSurahId, recitationContextJuzId, setContext]);

  return (
    <main className="h-full w-full overflow-hidden flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 bg-[var(--color-bg)]"
        data-vbv-scroll
        onScroll={() => {
          const container = scrollContainerRef.current;
          if (container) {
            handleScrollFocusPage(
              getFirstFullyVisiblePage(container) ?? (type === "p" ? id : null),
            );
          }
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
            const scrollContainer = scrollContainerRef.current;
            setNavSelection({
              page: scrollContainer ? getFirstFullyVisiblePage(scrollContainer) : labelPage,
              verseKey: scrollContainer ? getFirstFullyVisibleVerse(scrollContainer) : verseParam,
            });
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
