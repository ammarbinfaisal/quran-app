"use client";

import { useEffect, useMemo, useState } from "react";
import type { MushafCode } from "@/lib/preferences";
import { DEFAULT_MAX_PAGE_WIDTH_SWIPE_PX, PAGE_HEIGHT_OVER_WIDTH } from "@/mushaf-engine/constants";
import { MushafPage } from "@/mushaf-engine/rendering/MushafPage";
import type { MushafRuntime } from "@/mushaf-engine/runtime/MushafRuntime";

export function MushafSwipeView(props: {
  mushafCode: MushafCode;
  startPage: number;
  endPage: number;
  runtime: MushafRuntime;
  onVerseSelect: (verseKey: string) => void;
  maxPageWidthPx?: number;
  showDebug?: boolean;
}) {
  const {
    mushafCode,
    startPage,
    endPage,
    runtime,
    onVerseSelect,
    maxPageWidthPx = DEFAULT_MAX_PAGE_WIDTH_SWIPE_PX,
    showDebug = false,
  } = props;

  const [page, setPage] = useState(startPage);

  useEffect(() => {
    setPage(startPage);
  }, [startPage]);

  const canPrev = page > startPage;
  const canNext = page < endPage;

  const pinned = useMemo(() => {
    return [page - 1, page, page + 1].filter((p) => p >= startPage && p <= endPage);
  }, [page, startPage, endPage]);

  useEffect(() => {
    runtime.setPinnedPages(pinned);
    runtime.prefetch(pinned);
  }, [runtime, pinned]);

  const debug = runtime.getDebugSnapshot();

  return (
    <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-2 py-3 gap-3">
      <div className="w-full flex items-center justify-between max-w-4xl">
        <button
          type="button"
          className="h-9 px-3 rounded-md border border-border bg-card disabled:opacity-40"
          disabled={!canPrev}
          onClick={() => setPage((p) => Math.max(startPage, p - 1))}
        >
          Prev
        </button>
        <div className="text-sm text-muted-foreground">
          Page {page} / {endPage}
        </div>
        <button
          type="button"
          className="h-9 px-3 rounded-md border border-border bg-card disabled:opacity-40"
          disabled={!canNext}
          onClick={() => setPage((p) => Math.min(endPage, p + 1))}
        >
          Next
        </button>
      </div>

      <div
        className="w-full max-w-4xl"
        style={{
          width: `min(100%, ${maxPageWidthPx}px)`,
          aspectRatio: `1 / ${PAGE_HEIGHT_OVER_WIDTH}`,
        }}
        data-testid="mushaf-swipe-frame"
      >
        <MushafPage
          mushafCode={mushafCode}
          page={page}
          runtime={runtime}
          onVerseSelect={onVerseSelect}
        />
      </div>

      {showDebug ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
          <div>pinned: {pinned.join(", ")}</div>
          <div>
            fonts: {debug.fontCacheEntries} (
            {Math.round(debug.fontCacheBytes / 1024 / 1024)}MB)
          </div>
        </div>
      ) : null}
    </div>
  );
}

