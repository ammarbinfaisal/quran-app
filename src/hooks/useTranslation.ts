"use client";

import { useState } from "react";
import type { TranslationId } from "@/lib/types";
import type { TranslationContent } from "@/lib/footnotes";
import { loadTranslation } from "@/lib/translations/loader";

const EMPTY: TranslationContent = { segments: [], plain: "" };
const translationCache = new Map<string, TranslationContent>();
const translationRequests = new Map<string, Promise<TranslationContent>>();

type TranslationState = {
  requestKey: string | null;
  content: TranslationContent;
  loading: boolean;
  startedRequestKey: string | null;
};

function getInitialState(requestKey: string | null): TranslationState {
  if (!requestKey) {
    return { requestKey, content: EMPTY, loading: false, startedRequestKey: null };
  }

  const cached = translationCache.get(requestKey);
  if (cached !== undefined) {
    return { requestKey, content: cached, loading: false, startedRequestKey: requestKey };
  }

  return { requestKey, content: EMPTY, loading: true, startedRequestKey: null };
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
 * Loads a translation for a given verse key.
 * Results are cached in a module-level Map so switching back to a previously
 * loaded verse does not trigger a re-fetch.
 */
export function useTranslation(
  verseKey: string | null,
  translationId: TranslationId,
): { content: TranslationContent; loading: boolean } {
  const requestKey = verseKey ? `${translationId}:${verseKey}` : null;
  const [state, setState] = useState(() => getInitialState(requestKey));

  let currentState = state;

  if (state.requestKey !== requestKey) {
    currentState = getInitialState(requestKey);
    setState(currentState);
  }

  if (
    requestKey &&
    verseKey &&
    currentState.loading &&
    currentState.startedRequestKey !== requestKey
  ) {
    currentState = { ...currentState, startedRequestKey: requestKey };
    setState(currentState);
    queueMicrotask(() => {
      void loadTranslationCached(requestKey, verseKey, translationId)
        .then((result) => {
          setState((prev) =>
            prev.requestKey === requestKey
              ? {
                  requestKey,
                  content: result,
                  loading: false,
                  startedRequestKey: requestKey,
                }
              : prev,
          );
        })
        .catch(() => {
          setState((prev) =>
            prev.requestKey === requestKey
              ? {
                  requestKey,
                  content: EMPTY,
                  loading: false,
                  startedRequestKey: requestKey,
                }
              : prev,
          );
        });
    });
  }

  return { content: currentState.content, loading: currentState.loading };
}
