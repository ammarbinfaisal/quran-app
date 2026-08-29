"use client";

import { useState, useTransition } from "react";
import { BookMarked, FileText, Library } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useChapters } from "@/hooks/useChapters";
import { pageToJuz, pageToSurah, fetchVersePages } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { getFirstFullyVisibleVerse } from "@/lib/viewport";
import type { UserPreferences, VbvSubmode } from "@/lib/types";
import { IconSegmentedToggle, type IconSegmentedOption } from "@/components/navigation/IconSegmentedToggle";

const OPTIONS: ReadonlyArray<IconSegmentedOption<VbvSubmode>> = [
  { value: "s", label: "Surah", Icon: BookMarked },
  { value: "j", label: "Juz", Icon: Library },
  { value: "p", label: "Page", Icon: FileText },
];

interface SubmodeToggleProps {
  currentType: VbvSubmode;
  currentId: number;
  ariaLabel: string;
  preferenceKey: Extract<keyof UserPreferences, "vbvSubmode" | "scrollSubmode">;
  scrollSelector: string;
  onNavigate: (type: VbvSubmode, id: number, verse?: string | null) => void;
}

export function SubmodeToggle({
  currentType,
  currentId,
  ariaLabel,
  preferenceKey,
  scrollSelector,
  onNavigate,
}: SubmodeToggleProps) {
  const { prefs, setPref } = usePreferences();
  const chapters = useChapters();
  const [pendingSubmode, setPendingSubmode] = useState<VbvSubmode | null>(null);
  const [isRoutePending, startRouteTransition] = useTransition();

  // Clear pending state when the route transition completes (adjust-state-during-render)
  if (pendingSubmode && currentType === pendingSubmode && !isRoutePending) {
    setPendingSubmode(null);
  }

  async function handleSelect(newSubmode: VbvSubmode) {
    if (newSubmode === currentType || pendingSubmode !== null) return;

    setPendingSubmode(newSubmode);
    setPref(preferenceKey, newSubmode);

    const scrollContainer = document.querySelector(scrollSelector);
    const currentVerse = scrollContainer
      ? getFirstFullyVisibleVerse(scrollContainer as HTMLElement)
      : null;

    let currentPage = 1;
    let currentSurah = currentId;

    if (currentVerse) {
      const versePages = await fetchVersePages(prefs.mushafCode);
      const lookup = versePages[currentVerse];
      if (lookup) {
        currentPage = typeof lookup === "number" ? lookup : lookup[0];
      }
      currentSurah = Number.parseInt(currentVerse.split(":")[0], 10);
    } else {
      if (currentType === "p") {
        currentPage = currentId;
      } else if (currentType === "s") {
        const chapter = chapters.find((c) => c.id === currentId);
        currentPage = chapter ? chapter.pages[0] : 1;
      } else {
        const juz = JUZ_PAGE_RANGES.find((jr) => jr.juz === currentId);
        currentPage = juz ? juz.pages[0] : 1;
      }

      if (currentType === "s") {
        currentSurah = currentId;
      } else {
        currentSurah = pageToSurah(currentPage, chapters);
      }
    }

    let targetId: number;
    if (newSubmode === "p") {
      targetId = currentPage;
    } else if (newSubmode === "s") {
      targetId = currentSurah;
    } else {
      targetId = pageToJuz(currentPage);
    }

    startRouteTransition(() => {
      onNavigate(newSubmode, targetId, currentVerse);
    });
  }

  return (
    <IconSegmentedToggle
      options={OPTIONS}
      value={currentType}
      pendingValue={pendingSubmode}
      ariaLabel={ariaLabel}
      onSelect={handleSelect}
      itemWidth="var(--reader-nav-submode-item-width)"
      className="reader-bottom-nav-submode"
    />
  );
}
