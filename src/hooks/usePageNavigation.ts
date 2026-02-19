"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { getPreferences } from "@/lib/preferences";
import type { MushafCode } from "@/lib/types";

export function usePageNavigation() {
  const router = useRouter();

  const goToPage = useCallback(
    (page: number, mushaf?: MushafCode, verse?: string) => {
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
      const code = mushaf ?? getPreferences().mushafCode;
      let url = `/${clamped}/${code}`;
      if (verse) url += `?verse=${verse}`;
      router.push(url);
    },
    [router],
  );

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return { goToPage, goHome };
}
