"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { VisibleRangeStore, type VisibleRange } from "@/mushaf-engine/windowing/visibleRangeStore";

export function useVisibleRange(params: {
  scrollEl: HTMLElement | null;
  pageBlockHeight: number;
  totalCount: number;
  bufferBehind: number;
  bufferAhead: number;
  zoomRef?: { current: number };
}): { range: VisibleRange; store: VisibleRangeStore } {
  const { scrollEl, pageBlockHeight, totalCount, bufferBehind, bufferAhead, zoomRef } =
    params;

  const store = useMemo(() => {
    const initial: VisibleRange = {
      startIndex: 0,
      endIndex: 0,
      firstVisibleIndex: 0,
      lastVisibleIndex: 0,
      direction: "down",
    };
    return new VisibleRangeStore(initial);
  }, []);

  store.setConfig({ pageBlockHeight, totalCount, bufferBehind, bufferAhead, zoomRef });

  useEffect(() => {
    store.attach(scrollEl);
    return () => store.detach();
  }, [store, scrollEl]);

  const range = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { range, store };
}

