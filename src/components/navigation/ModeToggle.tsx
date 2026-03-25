"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlignLeft, BookOpen, ScrollText } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { usePreferences } from "@/hooks/usePreferences";
import { pageToFirstVerse, pageToJuz, pageToSurah, fetchVersePages } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { parseScrollPath, parseVbvPath, mushafPath, scrollPath, vbvPath } from "@/lib/url";
import { getFirstFullyVisiblePage, getFirstFullyVisibleVerse } from "@/lib/viewport";
import { IconSegmentedToggle, type IconSegmentedOption } from "@/components/navigation/IconSegmentedToggle";

type MainMode = "p" | "v" | "s";

const MODE_OPTIONS: ReadonlyArray<IconSegmentedOption<MainMode>> = [
  { value: "p", label: "Page", Icon: BookOpen },
  { value: "v", label: "Verse", Icon: AlignLeft },
  { value: "s", label: "Scroll", Icon: ScrollText },
];

function getMainMode(pathname: string): MainMode {
  if (pathname.startsWith("/v/")) return "v";
  if (pathname.startsWith("/s/")) return "s";
  return "p";
}

function getStartPageFromSubmode(
  type: "p" | "s" | "j",
  id: number,
  chapters: ReturnType<typeof useChapters>,
): number {
  if (type === "p") return id;
  if (type === "s") {
    const chapter = chapters.find((c) => c.id === id);
    return chapter ? chapter.pages[0] : 1;
  }
  const juz = JUZ_PAGE_RANGES.find((entry) => entry.juz === id);
  return juz ? juz.pages[0] : 1;
}

interface AnchorPosition {
  page: number;
  verse: string | null;
}

export function ModeToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const chapters = useChapters();
  const { prefs } = usePreferences();

  const mode = useMemo(() => getMainMode(pathname), [pathname]);
  const [pendingMode, setPendingMode] = useState<MainMode | null>(null);
  const [isRoutePending, startRouteTransition] = useTransition();

  // Clear pending state when the route transition completes (adjust-state-during-render)
  if (pendingMode && mode === pendingMode && !isRoutePending) {
    setPendingMode(null);
  }

  async function resolveAnchor(): Promise<AnchorPosition> {
    if (mode === "v") {
      const scrollContainer = document.querySelector("[data-vbv-scroll]") as HTMLElement | null;
      let targetVerse: string | null = null;
      let targetPage: number | null = null;

      if (scrollContainer) {
        targetVerse = getFirstFullyVisibleVerse(scrollContainer);
        if (targetVerse) {
          const versePages = await fetchVersePages(prefs.mushafCode);
          const lookup = versePages[targetVerse];
          if (lookup) {
            targetPage = typeof lookup === "number" ? lookup : lookup[0];
          }
        }
      }

      if (!targetPage) {
        const parsed = parseVbvPath(pathname);
        if (parsed) {
          targetPage = getStartPageFromSubmode(parsed.type, parsed.id, chapters);
        }
      }

      return {
        page: targetPage ?? 1,
        verse: targetVerse,
      };
    }

    if (mode === "s") {
      const scrollContainer = document.querySelector("[data-scroll-reader]") as HTMLElement | null;
      let targetVerse: string | null = null;
      let targetPage: number | null = null;

      if (scrollContainer) {
        targetVerse = getFirstFullyVisibleVerse(scrollContainer);
        if (targetVerse) {
          const versePages = await fetchVersePages(prefs.mushafCode);
          const lookup = versePages[targetVerse];
          if (lookup) {
            targetPage = typeof lookup === "number" ? lookup : lookup[0];
          }
        }

        if (!targetPage) {
          targetPage = getFirstFullyVisiblePage(scrollContainer);
        }
      }

      if (!targetPage) {
        const parsed = parseScrollPath(pathname);
        if (parsed) {
          targetPage = getStartPageFromSubmode(parsed.type, parsed.id, chapters);
        }
      }

      return {
        page: targetPage ?? 1,
        verse: targetVerse,
      };
    }

    const matchPage = pathname.match(/\/p\/([0-9]+)/);
    const page = matchPage ? Number.parseInt(matchPage[1], 10) : 1;
    const verse = searchParams.get("verse");

    return {
      page: Number.isFinite(page) ? page : 1,
      verse,
    };
  }

  async function buildTargetPath(targetMode: MainMode): Promise<string> {
    const anchor = await resolveAnchor();

    if (targetMode === "p") {
      return mushafPath(anchor.page, anchor.verse);
    }

    const targetVerse = anchor.verse ?? (await pageToFirstVerse(anchor.page, prefs.mushafCode));

    if (targetMode === "v") {
      const submode = prefs.vbvSubmode ?? "s";
      if (submode === "s") {
        return vbvPath("s", pageToSurah(anchor.page, chapters), targetVerse);
      }
      if (submode === "j") {
        return vbvPath("j", pageToJuz(anchor.page), targetVerse);
      }
      return vbvPath("p", anchor.page, targetVerse);
    }

    const submode = prefs.scrollSubmode ?? "p";
    if (submode === "s") {
      return scrollPath("s", pageToSurah(anchor.page, chapters), targetVerse);
    }
    if (submode === "j") {
      return scrollPath("j", pageToJuz(anchor.page), targetVerse);
    }
    return scrollPath("p", anchor.page, targetVerse);
  }

  async function handleSelect(nextMode: MainMode) {
    if (nextMode === mode || pendingMode !== null) return;

    setPendingMode(nextMode);

    try {
      const targetPath = await buildTargetPath(nextMode);
      startRouteTransition(() => {
        router.push(targetPath, { scroll: false });
      });
    } catch {
      setPendingMode(null);
    }
  }

  return (
    <IconSegmentedToggle
      options={MODE_OPTIONS}
      value={mode}
      pendingValue={pendingMode}
      ariaLabel="Reading mode"
      onSelect={handleSelect}
      itemWidthPx={24}
      iconClassName="h-3.5 w-3.5"
      className="w-[76px]"
    />
  );
}
