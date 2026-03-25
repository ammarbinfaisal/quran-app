"use client";

import {
  getCachedMushafPage,
  loadMushafPage,
  preloadAdjacentPages,
} from "@/lib/mushaf/loader";
import {
  getFontFamily,
  isFontLoaded,
  isQcfCode,
  loadQcfFont,
  loadUnicodeFont,
  preloadAdjacentFonts,
  releaseActiveQcfPage,
  retainActiveQcfPage,
} from "@/lib/mushaf/fonts";
import type { MushafCode, MushafPagePayload } from "@/lib/types";
import { useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";

/**
 * Hook that loads mushaf page data and the corresponding QCF font (if needed).
 * Also preloads adjacent pages' fonts.
 */
export function useMushafPage(code: MushafCode, pageNum: number) {
  const cached = getCachedMushafPage(code, pageNum);

  const [pageData, setPageData] = useState<MushafPagePayload | null>(() => cached);
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [fontReady, setFontReady] = useState<boolean>(() => {
    const fam = getFontFamily(code, pageNum);
    return isFontLoaded(fam);
  });
  const [showFontSkeleton, setShowFontSkeleton] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useMountEffect(() => {
    let cancelled = false;
    let skeletonTimer: ReturnType<typeof setTimeout> | null = null;
    const shouldTrackQcfPage = isQcfCode(code);

    if (shouldTrackQcfPage) {
      retainActiveQcfPage(code, pageNum);
    }

    async function load() {
      try {
        setError(null);

        // sync cache check on every navigation
        const now = getCachedMushafPage(code, pageNum);
        if (now) {
          setPageData(now);
          setLoading(false);
        } else {
          setPageData(null);
          setLoading(true);
        }

        // sync font status
        const fam = getFontFamily(code, pageNum);
        const initialFontReady = isFontLoaded(fam);
        setFontReady(initialFontReady);
        setShowFontSkeleton(false);
        if (!initialFontReady) {
          skeletonTimer = setTimeout(() => {
            if (!cancelled) setShowFontSkeleton(true);
          }, 140);
        }

        // Kick off page JSON + font load in parallel to minimize first-render skeleton time.
        const dataPromise = loadMushafPage(code, pageNum);
        const fontPromise = isQcfCode(code)
          ? loadQcfFont(code, pageNum)
          : loadUnicodeFont(code);

        fontPromise
          .then(() => {
            if (cancelled) return;
            if (skeletonTimer) clearTimeout(skeletonTimer);
            setFontReady(true);
            setShowFontSkeleton(false);
          })
          .catch((err) => console.error("Font loading failed", err));

        const data = await dataPromise;
        if (!cancelled) {
          setPageData(data);
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
    preloadAdjacentPages(code, pageNum, 6);
    if (shouldTrackQcfPage) preloadAdjacentFonts(code, pageNum);

    return () => {
      cancelled = true;
      if (skeletonTimer) clearTimeout(skeletonTimer);
      if (shouldTrackQcfPage) {
        releaseActiveQcfPage(code, pageNum);
      }
    };
  });

  return { pageData, loading, fontReady, showFontSkeleton, error };
}
