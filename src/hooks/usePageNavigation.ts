"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { getPreferences } from "@/lib/preferences";
import { vbvPath, mushafPath } from "@/lib/url";

export function usePageNavigation() {
  const router = useRouter();

  const goToPage = useCallback(
    (page: number, _mushaf?: unknown, verse?: string) => {
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
      const { viewMode } = getPreferences();
      if (viewMode === "vbv") {
        // Always navigate to page submode regardless of vbvSubmode preference
        router.push(vbvPath("p", clamped, verse));
      } else {
        router.push(mushafPath(clamped, verse));
      }
    },
    [router],
  );

  const goToSurah = useCallback(
    (surahId: number, startPage: number) => {
      const { viewMode } = getPreferences();
      if (viewMode === "vbv") {
        // Always navigate to surah submode regardless of vbvSubmode preference
        router.push(vbvPath("s", surahId));
      } else {
        const clamped = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        router.push(mushafPath(clamped));
      }
    },
    [router],
  );

  const goToJuz = useCallback(
    (juzId: number, startPage: number) => {
      const { viewMode } = getPreferences();
      if (viewMode === "vbv") {
        // Always navigate to juz submode regardless of vbvSubmode preference
        router.push(vbvPath("j", juzId));
      } else {
        const clamped = Math.max(1, Math.min(TOTAL_PAGES, startPage));
        router.push(mushafPath(clamped));
      }
    },
    [router],
  );

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return { goToPage, goToSurah, goToJuz, goHome };
}
