"use client";

import { useState, useEffect } from "react";
import type { MushafCode } from "@/lib/types";
import {
  isQcfCode,
  loadQcfFont,
  preloadAdjacentFonts,
} from "@/lib/mushaf/fonts";

interface UseQcfFontResult {
  loaded: boolean;
}

/**
 * Hook that loads a QCF font for the given mushaf code and page number.
 * Also preloads adjacent page fonts.
 */
export function useQcfFont(code: MushafCode, pageNum: number): UseQcfFontResult {
  const [loaded, setLoaded] = useState(() => !isQcfCode(code));

  useEffect(() => {
    if (!isQcfCode(code)) return;

    let cancelled = false;

    loadQcfFont(code, pageNum)
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });

    // Preload adjacent fonts (cleanup is handled inside preloadAdjacentFonts)
    preloadAdjacentFonts(code, pageNum);

    return () => {
      cancelled = true;
    };
  }, [code, pageNum]);

  return { loaded };
}
