"use client";

import { useEffect } from "react";
import { scheduleReaderPrefetch, type ReaderPrefetchRequest } from "@/lib/prefetch/readerPrefetch";

export function useReaderDataPrefetch(request: ReaderPrefetchRequest): void {
  const { mushafCode, dataUsageMode, translationIds, scopeType, focusPage, scopePages } = request;
  const signature = [
    mushafCode,
    dataUsageMode,
    scopeType,
    focusPage ?? "none",
    translationIds.join(","),
    scopePages.join(","),
  ].join("|");

  useEffect(() => {
    queueMicrotask(() => {
      scheduleReaderPrefetch({
        mushafCode,
        dataUsageMode,
        translationIds,
        scopeType,
        focusPage,
        scopePages,
      });
    });
  }, [dataUsageMode, focusPage, mushafCode, scopePages, scopeType, signature, translationIds]);
}
