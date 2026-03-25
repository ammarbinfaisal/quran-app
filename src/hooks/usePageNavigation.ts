"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { getPreferences } from "@/lib/preferences";
import { vbvPath, mushafPath, scrollPath } from "@/lib/url";
import { getChapters } from "@/lib/chapters";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { prefetchNavigationTarget } from "@/lib/prefetch/readerPrefetch";

export function usePageNavigation() {
  const router = useRouter();

  const warmPage = useCallback((page: number) => {
    const prefs = getPreferences();
    prefetchNavigationTarget(
      prefs.mushafCode,
      prefs.dataUsageMode,
      prefs.translationIds,
      page,
    );
  }, []);

  const goToPage = useCallback(
    (page: number, _mushaf?: unknown, verse?: string) => {
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
      const { viewMode } = getPreferences();
      warmPage(clamped);
      if (viewMode === "vbv") {
        // Always navigate to page submode regardless of vbvSubmode preference
        router.push(vbvPath("p", clamped, verse));
      } else if (viewMode === "scroll") {
        router.push(scrollPath("p", clamped, verse));
      } else {
        router.push(mushafPath(clamped, verse));
      }
    },
    [router, warmPage],
  );

  const goToSurah = useCallback(
    (surahId: number, startPage: number) => {
      const { viewMode } = getPreferences();
      if (viewMode === "vbv") {
        const chapters = getChapters();
        const ch = chapters.find((c) => c.id === surahId);
        const firstPage = ch?.pages?.[0] ?? startPage;
        warmPage(Math.max(1, Math.min(TOTAL_PAGES, firstPage)));
        // Always navigate to surah submode regardless of vbvSubmode preference
        router.push(vbvPath("s", surahId));
      } else if (viewMode === "scroll") {
        const chapters = getChapters();
        const ch = chapters.find((c) => c.id === surahId);
        const firstPage = ch?.pages?.[0] ?? startPage;
        warmPage(Math.max(1, Math.min(TOTAL_PAGES, firstPage)));
        router.push(scrollPath("s", surahId));
      } else {
        const clamped = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        warmPage(clamped);
        router.push(mushafPath(clamped));
      }
    },
    [router, warmPage],
  );

  const goToJuz = useCallback(
    (juzId: number, startPage: number) => {
      const { viewMode } = getPreferences();
      if (viewMode === "vbv") {
        const j = JUZ_PAGE_RANGES.find((jz) => jz.juz === juzId);
        const firstPage = j?.pages?.[0] ?? startPage;
        warmPage(Math.max(1, Math.min(TOTAL_PAGES, firstPage)));
        // Always navigate to juz submode regardless of vbvSubmode preference
        router.push(vbvPath("j", juzId));
      } else if (viewMode === "scroll") {
        const j = JUZ_PAGE_RANGES.find((jz) => jz.juz === juzId);
        const firstPage = j?.pages?.[0] ?? startPage;
        warmPage(Math.max(1, Math.min(TOTAL_PAGES, firstPage)));
        router.push(scrollPath("j", juzId));
      } else {
        const clamped = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        warmPage(clamped);
        router.push(mushafPath(clamped));
      }
    },
    [router, warmPage],
  );

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return { goToPage, goToSurah, goToJuz, goHome };
}
