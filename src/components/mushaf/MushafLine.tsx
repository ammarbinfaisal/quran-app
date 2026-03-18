"use client";

import React from "react";
import type { MushafLine as MushafLineType, MushafCode } from "@/lib/types";
import { QCF_CODES } from "@/lib/types";
import { MushafWord } from "@/components/mushaf/MushafWord";
import { getTapAnchorFromEvent, type OnWordTap } from "@/lib/wordTap";

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

interface VerseLineGroup {
  verseKey: string;
  tokenCount: number;
  items: Array<{
    idx: number;
    word: MushafLineType["words"][number];
    morphIndex: number;
  }>;
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

  const verseGroups: VerseLineGroup[] = [];
  for (const [idx, word] of line.words.entries()) {
    const lastGroup = verseGroups[verseGroups.length - 1];
    if (lastGroup?.verseKey === word.verseKey) {
      lastGroup.items.push({ idx, word, morphIndex: morphIndices[idx] ?? -1 });
      lastGroup.tokenCount++;
      continue;
    }

    verseGroups.push({
      verseKey: word.verseKey,
      tokenCount: 1,
      items: [{ idx, word, morphIndex: morphIndices[idx] ?? -1 }],
    });
  }

  function handleVerseTap(
    event: React.MouseEvent<HTMLDivElement>,
    verseKey: string,
  ) {
    event.stopPropagation();
    onWordTap({
      verseKey,
      wordIndex: null,
      charTypeName: "verse",
      anchor: getTapAnchorFromEvent(event),
    });
  }

  // Unicode lines use text-align justify (browser handles inter-word spacing better
  // than flexbox space-between for real Arabic text).
  if (isUnicode) {
    const className = centered
      ? "mushaf-line mushaf-line-unicode mushaf-line-centered"
      : "mushaf-line mushaf-line-unicode";

    return (
      <div className={className}>
        {verseGroups.map((group) => (
          <div
            key={`${group.verseKey}-${group.items[0]?.idx ?? 0}`}
            className="mushaf-verse-group"
            data-highlighted={highlightedVerse === group.verseKey}
            data-verse-key={group.verseKey}
            style={{ "--verse-word-count": String(group.tokenCount) } as React.CSSProperties}
            onClick={(event) => handleVerseTap(event, group.verseKey)}
          >
            {group.items.map(({ idx, word, morphIndex }) => (
              <MushafWord
                key={`${word.verseKey}-${idx}`}
                word={word}
                wordIndex={morphIndex}
                mushafCode={mushafCode}
                pageNum={pageNum}
                onTap={onWordTap}
                highlighted={false}
                fontReady={fontReady}
                showFontSkeleton={showFontSkeleton}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // QCF lines: flexbox with space-between; each word is flex-shrink: 0
  const className = centered
    ? "mushaf-line mushaf-line-centered"
    : "mushaf-line";

  return (
    <div className={className}>
      {verseGroups.map((group) => (
        <div
          key={`${group.verseKey}-${group.items[0]?.idx ?? 0}`}
          className="mushaf-verse-group"
          data-highlighted={highlightedVerse === group.verseKey}
          data-verse-key={group.verseKey}
          style={{ "--verse-word-count": String(group.tokenCount) } as React.CSSProperties}
          onClick={(event) => handleVerseTap(event, group.verseKey)}
        >
          {group.items.map(({ idx, word, morphIndex }) => (
            <MushafWord
              key={`${word.verseKey}-${idx}`}
              word={word}
              wordIndex={morphIndex}
              mushafCode={mushafCode}
              pageNum={pageNum}
              onTap={onWordTap}
              highlighted={false}
              fontReady={fontReady}
              showFontSkeleton={showFontSkeleton}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export const MushafLine = React.memo(MushafLineInner);
