"use client";

import { useState } from "react";
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
  const signature =
    verseKey && translationIds.length > 0
      ? `${verseKey}::${translationIds.join(",")}`
      : null;
  const [state, setState] = useState(() => ({
    signature,
    results: getInitialResults(verseKey, translationIds),
    startedSignature: null as string | null,
  }));

  let currentSignature = state.signature;
  let currentResults = state.results;
  let startedSignature = state.startedSignature;

  if (state.signature !== signature) {
    currentSignature = signature;
    currentResults = getInitialResults(verseKey, translationIds);
    startedSignature = null;
    setState({ signature, results: currentResults, startedSignature: null });
  }

  if (currentSignature && verseKey) {
    const toFetch = translationIds.filter((id) => currentResults[id]?.loading);

    if (toFetch.length > 0 && startedSignature !== currentSignature) {
      startedSignature = currentSignature;
      setState({
        signature: currentSignature,
        results: currentResults,
        startedSignature: currentSignature,
      });
      queueMicrotask(() => {
        const skeletonTimer = setTimeout(() => {
          setState((prev) => {
            if (prev.signature !== currentSignature) return prev;
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
            if (prev.signature !== currentSignature) return prev;
            const next = { ...prev.results };

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

            return { ...prev, results: next };
          });
        });
      });
    }
  }

  return currentResults;
}
