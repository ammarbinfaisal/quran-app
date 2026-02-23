"use client";

import { useState, useEffect, useRef } from "react";
import type { TranslationId } from "@/lib/types";
import { loadTranslation } from "@/lib/translations/loader";

/**
 * Loads a translation for a given verse key.
 * Results are cached in a ref Map so switching back to a previously
 * loaded verse does not trigger a re-fetch.
 */
export function useTranslation(
  verseKey: string | null,
  translationId: TranslationId,
): { text: string; loading: boolean } {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!verseKey) {
      setTimeout(() => {
        setText("");
        setLoading(false);
      }, 0);
      return;
    }

    const cacheKey = `${translationId}:${verseKey}`;
    const cached = cacheRef.current.get(cacheKey);

    if (cached !== undefined) {
      setTimeout(() => {
        setText(cached);
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
        setText(result);
      })
      .catch(() => {
        if (cancelled) return;
        setText("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [verseKey, translationId]);

  return { text, loading };
}
