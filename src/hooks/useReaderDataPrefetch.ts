"use client";

import { useEffect } from "react";
import { scheduleReaderPrefetch, type ReaderPrefetchRequest } from "@/lib/prefetch/readerPrefetch";

export function useReaderDataPrefetch(request: ReaderPrefetchRequest): void {
  const { mushafCode, dataUsageMode, translationIds, scopeType, focusPage, scopePages, tafsirOrder } = request;
  const signature = [
    mushafCode,
    dataUsageMode,
    scopeType,
    focusPage ?? "none",
    translationIds.join(","),
    scopePages.join(","),
    tafsirOrder?.join(",") ?? "",
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
        tafsirOrder,
      });
    });
  }, [dataUsageMode, focusPage, mushafCode, scopePages, scopeType, signature, tafsirOrder, translationIds]);
}
