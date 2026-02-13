"use client";

import { memo, useMemo } from "react";
import type { MushafCode } from "@/lib/preferences";
import { MUSHAF_VARIANTS_BY_CODE } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";
import { DEFAULT_COORD_WIDTH } from "@/mushaf-engine/constants";
import { useFont, usePagePayload } from "@/mushaf-engine/runtime/hooks";
import type { MushafRuntime } from "@/mushaf-engine/runtime/MushafRuntime";

function getLinesPerPage(mushafCode: MushafCode): number {
  const variant = MUSHAF_VARIANTS_BY_CODE[mushafCode];
  if (variant.lines === "16_lines") return 16;
  return 15;
}

function MushafPageImpl(props: {
  mushafCode: MushafCode;
  page: number;
  runtime: MushafRuntime;
  onVerseSelect: (verseKey: string) => void;
}) {
  const { mushafCode, page, runtime, onVerseSelect } = props;

  const payloadSnap = usePagePayload(runtime, page);
  const fontSnap = useFont(runtime, page);

  const linesPerPage = getLinesPerPage(mushafCode);
  const payload = payloadSnap.status === "ready" ? payloadSnap.payload : null;

  const canShowText = payload != null && fontSnap.status === "ready";

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        fontFamily: `'${fontSnap.family}'`,
        direction: "rtl",
        contain: "layout paint style",
      }}
      data-testid="mushaf-page"
      data-page={page}
    >
      <div className="absolute inset-0 rounded-xl border border-border bg-card/40" />

      {!canShowText ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="w-7 h-7 border-2 border-current border-t-transparent rounded-full animate-spin opacity-30" />
          <div>Loading page {page}…</div>
        </div>
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          opacity: canShowText ? 1 : 0,
          contain: "layout paint style",
        }}
        aria-hidden={!canShowText}
      >
        {payload ? (
          <MushafTextLayer
            payload={payload}
            coordWidth={DEFAULT_COORD_WIDTH}
            linesPerPage={linesPerPage}
            onVerseSelect={onVerseSelect}
          />
        ) : null}
      </div>
    </div>
  );
}

export const MushafPage = memo(MushafPageImpl);

function MushafTextLayer(props: {
  payload: MushafPagePayload;
  coordWidth: number;
  linesPerPage: number;
  onVerseSelect: (verseKey: string) => void;
}) {
  const { payload, coordWidth, linesPerPage, onVerseSelect } = props;

  const lines = useMemo(() => {
    const topPctPerLine = 100 / Math.max(1, linesPerPage);
    return payload.lines
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => {
        const topPct = (line.lineNumber - 1) * topPctPerLine;
        const words = line.words.map((w, idx) => {
          const leftPct = (w.x / coordWidth) * 100;
          const widthPct = (w.width / coordWidth) * 100;
          return (
            <span
              key={`${line.lineNumber}:${idx}:${w.verseKey}`}
              className="absolute top-0 whitespace-nowrap"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                fontSize: "clamp(14px, 2.2vw, 28px)",
                lineHeight: 1,
                cursor: "pointer",
                pointerEvents: "auto",
                userSelect: "none",
                textAlign: "right",
              }}
              role="button"
              tabIndex={0}
              onClick={() => onVerseSelect(w.verseKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onVerseSelect(w.verseKey);
              }}
            >
              {w.text}
            </span>
          );
        });

        return (
          <div
            key={`line:${line.lineNumber}`}
            className="absolute left-0 right-0"
            style={{
              top: `${topPct}%`,
              height: `${topPctPerLine}%`,
              pointerEvents: "none",
            }}
          >
            {words}
          </div>
        );
      });
  }, [payload.lines, coordWidth, linesPerPage, onVerseSelect]);

  return (
    <div className="absolute inset-0" translate="no">
      {lines}
    </div>
  );
}

