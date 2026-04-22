"use client";

import React from "react";
import type { MushafLine as MushafLineType, MushafCode } from "@/lib/types";
import { QCF_CODES } from "@/lib/types";
import { MushafWord } from "@/components/mushaf/MushafWord";
import type { OnWordTap } from "@/lib/wordTap";

interface MushafLineProps {
  line: MushafLineType;
  mushafCode: MushafCode;
  pageNum: number;
  onWordTap: OnWordTap;
  highlightedVerse?: string | null;
  fontReady: boolean;
  showFontSkeleton: boolean;
  centered?: boolean;
  /** Per-verse word count from previous lines on this page, keyed by verseKey */
  verseWordOffsets?: Record<string, number>;
}

function MushafLineInner({
  line,
  mushafCode,
  pageNum,
  onWordTap,
  highlightedVerse,
  fontReady,
  showFontSkeleton,
  centered,
  verseWordOffsets,
}: MushafLineProps) {
  const isUnicode = !(QCF_CODES as readonly string[]).includes(mushafCode);
  const className = centered
    ? "mushaf-line mushaf-line-centered"
    : "mushaf-line";

  if (!fontReady) {
    const lineSkeletonWidth = centered
      ? "58%"
      : `${Math.max(52, Math.min(100, line.words.length * 7))}%`;

    return (
      <div className={className} aria-hidden="true">
        <span
          className={`inline-block h-[0.72em] rounded-sm bg-[color-mix(in_srgb,var(--color-muted)_20%,transparent)] ${showFontSkeleton ? "animate-pulse" : ""}`}
          style={{ width: lineSkeletonWidth }}
        />
      </div>
    );
  }

  // Pre-compute the morphology-corpus word index for each token.
  // The corpus uses a 1-based index counting ONLY charTypeName === "word" tokens.
  // Non-word tokens (end markers, pause marks) get morphIndex = -1 (no morphology).
  // QCF mushafs (v2) support morphology; Unicode mushafs always open translation.
  // verseWordOffsets carries how many word-type tokens were already seen for each
  // verse in preceding lines on this page, so multi-line verses index correctly.
  const morphIndices: number[] = [];
  const verseCounters: Record<string, number> = {};
  for (const word of line.words) {
    if (!isUnicode && word.charTypeName === "word") {
      const vk = word.verseKey;
      if (!(vk in verseCounters)) {
        verseCounters[vk] = verseWordOffsets?.[vk] ?? 0;
      }
      morphIndices.push(verseCounters[vk]);
      verseCounters[vk]++;
    } else {
      morphIndices.push(-1);
    }
  }

  // Stop propagation when the click lands on the line container itself (i.e.
  // the residual slack between --mushaf-line-width and the slot), but allow
  // clicks on mushaf-word spans to bubble normally — those already call
  // stopPropagation themselves.
  function handleLineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).classList.contains("mushaf-word")) {
      e.stopPropagation();
    }
  }

  const renderWord = (word: typeof line.words[number], idx: number) => (
    <MushafWord
      key={`${word.verseKey}-${idx}`}
      word={word}
      wordIndex={morphIndices[idx]}
      mushafCode={mushafCode}
      pageNum={pageNum}
      onTap={onWordTap}
      highlighted={highlightedVerse === word.verseKey}
      fontReady={fontReady}
      showFontSkeleton={showFontSkeleton}
    />
  );

  // QCF: words render adjacent; the per-page font's intrinsic glyph advance
  // fills --mushaf-line-width exactly, `text-align: center` absorbs any
  // residual slack. No whitespace between spans.
  //
  // Unicode (Indopak): insert literal whitespace between spans so
  // `text-align: justify` has inter-word break opportunities to stretch.
  if (isUnicode) {
    const unicodeClassName = centered
      ? "mushaf-line mushaf-line-unicode mushaf-line-centered"
      : "mushaf-line mushaf-line-unicode";

    const children: React.ReactNode[] = [];
    line.words.forEach((word, idx) => {
      if (idx > 0) children.push(" ");
      children.push(renderWord(word, idx));
    });

    return (
      <div className={unicodeClassName} onClick={handleLineClick}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} onClick={handleLineClick}>
      {line.words.map((word, idx) => renderWord(word, idx))}
    </div>
  );
}

export const MushafLine = React.memo(MushafLineInner);
