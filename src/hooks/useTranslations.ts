"use client";

import { useState } from "react";
import type { TranslationId } from "@/lib/types";
import type { TranslationContent } from "@/lib/footnotes";
import { loadTranslation } from "@/lib/translations/loader";

type TranslationRowState = {
  content: TranslationContent;
  loading: boolean;
  showSkeleton: boolean;
};

const EMPTY: TranslationContent = { segments: [], plain: "" };
const EMPTY_RESULTS = {} as Record<TranslationId, TranslationRowState>;
const translationCache = new Map<string, TranslationContent>();
const translationRequests = new Map<string, Promise<TranslationContent>>();

function getInitialResults(
  verseKey: string | null,
  translationIds: TranslationId[],
): Record<TranslationId, TranslationRowState> {
  if (!verseKey || translationIds.length === 0) {
    return EMPTY_RESULTS;
  }

  const initial = {} as Record<TranslationId, TranslationRowState>;

  for (const id of translationIds) {
    const cacheKey = `${id}:${verseKey}`;
    const cached = translationCache.get(cacheKey);
    initial[id] = cached
      ? { content: cached, loading: false, showSkeleton: false }
      : { content: EMPTY, loading: true, showSkeleton: false };
  }

  return initial;
}

function loadTranslationCached(
  requestKey: string,
  verseKey: string,
  translationId: TranslationId,
) {
  const existing = translationRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const request = loadTranslation(verseKey, translationId)
    .then((result) => {
      translationCache.set(requestKey, result);
      return result;
    })
    .finally(() => {
      translationRequests.delete(requestKey);
    });

  translationRequests.set(requestKey, request);
  return request;
}

/**
 * Loads translations for a given verse key and list of translation IDs.
 * Returns pre-parsed TranslationContent (segments + plain text).
 * Results are cached in a module-level Map.
 */
export function useTranslations(
  verseKey: string | null,
  translationIds: TranslationId[],
): Record<TranslationId, TranslationRowState> {
  const signature =
    verseKey && translationIds.length > 0
      ? `${verseKey}::${translationIds.join(",")}`
      : null;
  const [state, setState] = useState(() => ({
    signature,
    results: getInitialResults(verseKey, translationIds),
  }));

  if (state.signature !== signature) {
    const nextResults = getInitialResults(verseKey, translationIds);
    setState({ signature, results: nextResults });

    if (signature && verseKey) {
      const toFetch = translationIds.filter((id) => nextResults[id]?.loading);

      if (toFetch.length > 0) {
        queueMicrotask(() => {
          const skeletonTimer = setTimeout(() => {
            setState((prev) => {
              if (prev.signature !== signature) return prev;
              const next = { ...prev.results };
              for (const id of toFetch) {
                const row = next[id];
                if (row?.loading) {
                  next[id] = { ...row, showSkeleton: true };
                }
              }
              return { ...prev, results: next };
            });
          }, 140);

          void Promise.allSettled(
            toFetch.map((id) =>
              loadTranslationCached(`${id}:${verseKey}`, verseKey, id).then(
                (content) => ({ id, content }),
              ),
            ),
          ).then((entries) => {
            clearTimeout(skeletonTimer);
            setState((prev) => {
              if (prev.signature !== signature) return prev;
              const next = { ...prev.results };

              for (const entry of entries) {
                if (entry.status === "fulfilled") {
                  next[entry.value.id] = {
                    content: entry.value.content,
                    loading: false,
                    showSkeleton: false,
                  };
                } else {
                  const failedId = toFetch[entries.indexOf(entry)];
                  next[failedId] = {
                    content: EMPTY,
                    loading: false,
                    showSkeleton: false,
                  };
                }
              }

              return { ...prev, results: next };
            });
          });
        });
      }
    }
  }

  return state.results;
}
