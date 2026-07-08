"use client";

import { useEffect, useMemo, useState } from "react";
import type { TranslationId } from "@/lib/types";
import type { TranslationContent } from "@/lib/footnotes";
import { loadTranslation } from "@/lib/translations/loader";
import {
  deleteTranslationRequest,
  getCachedTranslationContent,
  getTranslationRequest,
  setCachedTranslationContent,
  setTranslationRequest,
} from "@/lib/translations/runtimeCache";

type TranslationRowState = {
  content: TranslationContent;
  loading: boolean;
  showSkeleton: boolean;
};

type TranslationState = {
  signature: string | null;
  results: Record<TranslationId, TranslationRowState>;
};

const EMPTY: TranslationContent = { segments: [], plain: "" };
const EMPTY_RESULTS = {} as Record<TranslationId, TranslationRowState>;

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
    const cached = getCachedTranslationContent(cacheKey);
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
  const existing = getTranslationRequest(requestKey);
  if (existing) {
    return existing;
  }

  const request = loadTranslation(verseKey, translationId)
    .then((result) => {
      setCachedTranslationContent(requestKey, result);
      return result;
    })
    .finally(() => {
      deleteTranslationRequest(requestKey);
    });

  setTranslationRequest(requestKey, request);
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
  const translationIdsKey = translationIds.join(",");
  const currentTranslationIds = useMemo(
    () =>
      translationIdsKey
        ? (translationIdsKey.split(",") as TranslationId[])
        : [],
    [translationIdsKey],
  );
  const signature =
    verseKey && currentTranslationIds.length > 0
      ? `${verseKey}::${translationIdsKey}`
      : null;

  const initialResults = useMemo(
    () => getInitialResults(verseKey, currentTranslationIds),
    [verseKey, currentTranslationIds],
  );

  const [state, setState] = useState<TranslationState>(() => ({
    signature,
    results: initialResults,
  }));

  useEffect(() => {
    let active = true;
    let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

    if (!signature || !verseKey) {
      return () => {
        active = false;
      };
    }

    const toFetch = currentTranslationIds.filter(
      (id) => initialResults[id]?.loading,
    );

    if (toFetch.length === 0) {
      return () => {
        active = false;
      };
    }

    skeletonTimer = setTimeout(() => {
      if (!active) return;
      setState((prev) => {
        const next = {
          ...(prev.signature === signature ? prev.results : initialResults),
        };
        let changed = false;

        for (const id of toFetch) {
          const row = next[id];
          if (row?.loading && !row.showSkeleton) {
            next[id] = { ...row, showSkeleton: true };
            changed = true;
          }
        }

        if (!changed && prev.signature === signature) {
          return prev;
        }

        return { signature, results: next };
      });
    }, 140);

    void Promise.allSettled(
      toFetch.map((id) =>
        loadTranslationCached(`${id}:${verseKey}`, verseKey, id).then(
          (content) => ({ id, content }),
        ),
      ),
    ).then((entries) => {
      if (skeletonTimer) clearTimeout(skeletonTimer);
      if (!active) return;

      setState((prev) => {
        const next = {
          ...(prev.signature === signature ? prev.results : initialResults),
        };

        for (const [index, entry] of entries.entries()) {
          const id = toFetch[index];
          if (entry.status === "fulfilled") {
            next[id] = {
              content: entry.value.content,
              loading: false,
              showSkeleton: false,
            };
          } else {
            next[id] = {
              content: EMPTY,
              loading: false,
              showSkeleton: false,
            };
          }
        }

        return { signature, results: next };
      });
    });

    return () => {
      active = false;
      if (skeletonTimer) {
        clearTimeout(skeletonTimer);
      }
    };
  }, [currentTranslationIds, initialResults, signature, verseKey]);

  if (state.signature !== signature) {
    return initialResults;
  }

  return state.results;
}
