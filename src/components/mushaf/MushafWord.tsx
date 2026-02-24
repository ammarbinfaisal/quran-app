"use client";

import React from "react";
import type { MushafWord as MushafWordType, MushafCode } from "@/lib/types";
import { getFontFamily, isQcfCode } from "@/lib/mushaf/fonts";

interface MushafWordProps {
  word: MushafWordType;
  wordIndex: number;
  mushafCode: MushafCode;
  pageNum: number;
  onTap: (verseKey: string, wordIndex: number) => void;
  highlighted: boolean;
  fontReady: boolean;
  showFontSkeleton: boolean;
}

function MushafWordInner({
  word,
  wordIndex,
  mushafCode,
  pageNum,
  onTap,
  highlighted,
  fontReady,
  showFontSkeleton,
}: MushafWordProps) {
  const fontFamily = getFontFamily(mushafCode, pageNum);
  const isQcf = isQcfCode(mushafCode);

  const style: React.CSSProperties = {
    fontFamily,
  };

  if (!fontReady) {
    if (!showFontSkeleton) {
      return (
        <span
          className="mushaf-word"
          style={{
            display: "inline-block",
            width: "2.5em",
            height: "1.2em",
            margin: "0 2px",
          }}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className="mushaf-word animate-pulse bg-[var(--color-muted)]/20 rounded-sm"
        style={{ display: "inline-block", width: "2.5em", height: "1.2em", margin: "0 2px" }}
      />
    );
  }

  const textClass = isQcf ? "mushaf-text" : "mushaf-text-unicode";

  // QCF fonts use glyph codepoints that need innerHTML rendering
  if (isQcf) {
    return (
      <span
        className={`mushaf-word ${textClass}`}
        data-highlighted={highlighted}
        style={style}
        onClick={() => onTap(word.verseKey, wordIndex)}
        dangerouslySetInnerHTML={{ __html: word.text }}
      />
    );
  }

  return (
    <span
      className={`mushaf-word ${textClass}`}
      data-highlighted={highlighted}
      style={style}
      onClick={() => onTap(word.verseKey, wordIndex)}
    >
      {word.text}
    </span>
  );
}

export const MushafWord = React.memo(MushafWordInner);
