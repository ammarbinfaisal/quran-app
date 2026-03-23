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

  // Stop propagation when the click lands on the line container itself (i.e. the
  // flex gaps between words), but allow clicks on mushaf-word spans to bubble
  // normally — those already call stopPropagation themselves.
  function handleLineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).classList.contains("mushaf-word")) {
      e.stopPropagation();
    }
  }

  // Unicode lines use text-align justify (browser handles inter-word spacing better
  // than flexbox space-between for real Arabic text).
  if (isUnicode) {
    const className = centered
      ? "mushaf-line mushaf-line-unicode mushaf-line-centered"
      : "mushaf-line mushaf-line-unicode";

    return (
      <div className={className} onClick={handleLineClick}>
        {line.words.map((word, idx) => (
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
        ))}
      </div>
    );
  }

  // QCF lines: flexbox with space-between; each word is flex-shrink: 0
  const className = centered
    ? "mushaf-line mushaf-line-centered"
    : "mushaf-line";

  return (
    <div className={className} onClick={handleLineClick}>
      {line.words.map((word, idx) => (
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
      ))}
    </div>
  );
}

export const MushafLine = React.memo(MushafLineInner);
