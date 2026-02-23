"use client";

import { useState, useEffect, useRef } from "react";
import type { TranslationId } from "@/lib/types";
import type { TranslationContent } from "@/lib/footnotes";
import { loadTranslation } from "@/lib/translations/loader";

const EMPTY: TranslationContent = { segments: [], plain: "" };

/**
 * Loads a translation for a given verse key.
 * Results are cached in a ref Map so switching back to a previously
 * loaded verse does not trigger a re-fetch.
 */
export function useTranslation(
  verseKey: string | null,
  translationId: TranslationId,
): { content: TranslationContent; loading: boolean } {
  const [content, setContent] = useState<TranslationContent>(EMPTY);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, TranslationContent>>(new Map());

  useEffect(() => {
    if (!verseKey) {
      setTimeout(() => {
        setContent(EMPTY);
        setLoading(false);
      }, 0);
      return;
    }

    const cacheKey = `${translationId}:${verseKey}`;
    const cached = cacheRef.current.get(cacheKey);

    if (cached !== undefined) {
      setTimeout(() => {
        setContent(cached);
        setLoading(false);
      }, 0);
      return;
    }

    let cancelled = false;
    setTimeout(() => setLoading(true), 0);

    loadTranslation(verseKey, translationId)
      .then((result) => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, result);
        setContent(result);
      })
      .catch(() => {
        if (cancelled) return;
        setContent(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [verseKey, translationId]);

  return { content, loading };
}
