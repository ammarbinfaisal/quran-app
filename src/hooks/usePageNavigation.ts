"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { getPreferences } from "@/lib/preferences";
import { vbvPath, mushafPath } from "@/lib/url";
import { loadMushafPage, preloadAdjacentPages } from "@/lib/mushaf/loader";
import { loadQcfFont, preloadAdjacentFonts } from "@/lib/mushaf/fonts";
import { prefetchTranslationPage } from "@/lib/translations/loader";
import { loadAbuIyaadData } from "@/lib/translations/abu-iyaad";
import { getChapters } from "@/lib/chapters";
import { JUZ_PAGE_RANGES } from "@/lib/juz";

export function usePageNavigation() {
  const router = useRouter();

  const warmPage = useCallback((page: number) => {
    const prefs = getPreferences();
    const code = prefs.mushafCode;

    void loadMushafPage(code, page).catch(() => { });
    void loadQcfFont(code, page).catch(() => { });

    preloadAdjacentPages(code, page, 2);
    preloadAdjacentFonts(code, page, 2);

    if (prefs.translationIds.includes("abu-iyaad")) {
      void loadAbuIyaadData().catch(() => { });
    }

    for (const tid of prefs.translationIds) {
      if (tid === "abu-iyaad") continue;
      prefetchTranslationPage(page, tid);
    }
  }, []);

  const goToPage = useCallback(
    (page: number, _mushaf?: unknown, verse?: string) => {
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
      const { viewMode } = getPreferences();
      warmPage(clamped);
      if (viewMode === "vbv") {
        // Always navigate to page submode regardless of vbvSubmode preference
        router.push(vbvPath("p", clamped, verse));
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
