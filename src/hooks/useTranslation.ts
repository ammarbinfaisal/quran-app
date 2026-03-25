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

const EMPTY: TranslationContent = { segments: [], plain: "" };

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

  const cached = getCachedTranslationContent(requestKey);
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
