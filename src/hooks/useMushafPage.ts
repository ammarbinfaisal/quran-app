"use client";

import { useState, useEffect } from "react";
import type { MushafCode, MushafPagePayload } from "@/lib/types";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { isQcfCode, loadQcfFont, preloadAdjacentFonts } from "@/lib/mushaf/fonts";

interface UseMushafPageResult {
  pageData: MushafPagePayload | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook that loads mushaf page data and the corresponding QCF font (if needed).
 * Also preloads adjacent pages' fonts.
 */
export function useMushafPage(
  code: MushafCode,
  pageNum: number,
): UseMushafPageResult {
  const [pageData, setPageData] = useState<MushafPagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPageData(null);

    async function load() {
      try {
        // Load page data and font in parallel
        const promises: Promise<unknown>[] = [loadMushafPage(code, pageNum)];
        if (isQcfCode(code)) {
          promises.push(loadQcfFont(code, pageNum));
        }

        const [data] = await Promise.all(promises);

        if (!cancelled) {
          setPageData(data as MushafPagePayload);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load page");
          setLoading(false);
        }
      }
    }

    load();

    // Preload adjacent page fonts
    if (isQcfCode(code)) {
      preloadAdjacentFonts(code, pageNum);
    }

    return () => {
      cancelled = true;
    };
  }, [code, pageNum]);

  return { pageData, loading, error };
}
