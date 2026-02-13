"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MushafCode } from "@/lib/preferences";
import {
  DEFAULT_BUFFER_AHEAD,
  DEFAULT_BUFFER_BEHIND,
  DEFAULT_MAX_PAGE_WIDTH_SCROLL_PX,
  DEFAULT_PAGE_GAP_PX,
  PAGE_HEIGHT_OVER_WIDTH,
} from "@/mushaf-engine/constants";
import { MushafPage } from "@/mushaf-engine/rendering/MushafPage";
import type { MushafRuntime } from "@/mushaf-engine/runtime/MushafRuntime";
import { useElementSize } from "@/mushaf-engine/windowing/useElementSize";
import { usePinchZoom } from "@/mushaf-engine/windowing/usePinchZoom";
import { useVisibleRange } from "@/mushaf-engine/windowing/useVisibleRange";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function MushafScrollView(props: {
  mushafCode: MushafCode;
  startPage: number;
  endPage: number;
  runtime: MushafRuntime;
  onVerseSelect: (verseKey: string) => void;
  bufferBehind?: number;
  bufferAhead?: number;
  maxPageWidthPx?: number;
  pageGapPx?: number;
  showDebug?: boolean;
}) {
  const {
    mushafCode,
    startPage,
    endPage,
    runtime,
    onVerseSelect,
    bufferBehind = DEFAULT_BUFFER_BEHIND,
    bufferAhead = DEFAULT_BUFFER_AHEAD,
    maxPageWidthPx = DEFAULT_MAX_PAGE_WIDTH_SCROLL_PX,
    pageGapPx = DEFAULT_PAGE_GAP_PX,
    showDebug = false,
  } = props;

  const totalCount = Math.max(1, endPage - startPage + 1);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const { width: viewportWidth } = useElementSize(scrollEl);

  const spacerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);

  const pageWidthPx = clamp(viewportWidth - 16, 280, maxPageWidthPx);
  const pageHeightPx = Math.round(pageWidthPx * PAGE_HEIGHT_OVER_WIDTH);
  const pageBlockHeightPx = pageHeightPx + pageGapPx;

  const baseTotalHeightPx = totalCount * pageBlockHeightPx;

  const { range, store } = useVisibleRange({
    scrollEl,
    pageBlockHeight: pageBlockHeightPx,
    totalCount,
    bufferBehind,
    bufferAhead,
    zoomRef,
  });

  const pinnedPages = useMemo(() => {
    const pages: number[] = [];
    for (let i = range.startIndex; i <= range.endIndex; i += 1) pages.push(startPage + i);
    return pages;
  }, [range.startIndex, range.endIndex, startPage]);

  useEffect(() => {
    runtime.setPinnedPages(pinnedPages);

    const ordered = range.direction === "down" ? pinnedPages : pinnedPages.slice().reverse();
    runtime.prefetch(ordered);
  }, [runtime, pinnedPages, range.direction]);

  usePinchZoom({
    enabled: true,
    scrollEl,
    spacerRef,
    contentRef,
    zoomRef,
    baseContentHeightPx: baseTotalHeightPx,
    onAfterApply: () => store.schedule(),
  });

  const debug = runtime.getDebugSnapshot();

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={setScrollEl}
        className="h-full w-full overflow-y-auto scrollbar-none"
        style={{
          // Keep gesture model predictable: vertical scroll plus pinch.
          touchAction: "pan-y pinch-zoom",
          // Avoid scrollbar width affecting layout math (even if hidden).
          scrollbarGutter: "stable",
        }}
        data-testid="mushaf-scroll"
      >
        <div
          ref={spacerRef}
          className="relative w-full"
          data-testid="mushaf-scroll-spacer"
        >
          <div
            ref={contentRef}
            className="absolute left-0 right-0 top-0"
            style={{ height: baseTotalHeightPx }}
          >
            {pinnedPages.map((page) => {
              const index = page - startPage;
              const top = index * pageBlockHeightPx;
              return (
                <div
                  key={page}
                  className="absolute left-1/2"
                  style={{
                    top,
                    width: pageWidthPx,
                    height: pageHeightPx,
                    transform: "translateX(-50%)",
                    contain: "layout paint style size",
                  }}
                  data-testid={`mushaf-frame-${page}`}
                >
                  <MushafPage
                    mushafCode={mushafCode}
                    page={page}
                    runtime={runtime}
                    onVerseSelect={onVerseSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showDebug ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
          <div>
            range: {range.startIndex + 1}–{range.endIndex + 1} / {totalCount}
          </div>
          <div>mounted: {pinnedPages.length}</div>
          <div>
            fonts: {debug.fontCacheEntries} (
            {Math.round(debug.fontCacheBytes / 1024 / 1024)}MB)
          </div>
        </div>
      ) : null}
    </div>
  );
}
