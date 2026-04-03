"use client";

import React from "react";
import type { MushafWord as MushafWordType, MushafCode } from "@/lib/types";
import { getFontFamily, isQcfCode } from "@/lib/mushaf/fonts";
import { getTapAnchorFromEvent, type OnWordTap } from "@/lib/wordTap";

interface MushafWordProps {
  word: MushafWordType;
  wordIndex: number;
  mushafCode: MushafCode;
  pageNum: number;
  onTap: OnWordTap;
  highlighted: boolean;
  phraseColorIndex?: number | null;
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
  phraseColorIndex,
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

  function handleTap(event: React.MouseEvent<HTMLSpanElement>) {
    event.stopPropagation();
    if (!word.text) return;
    onTap({
      verseKey: word.verseKey,
      wordIndex: wordIndex >= 0 ? wordIndex : null,
      charTypeName: word.charTypeName,
      anchor: getTapAnchorFromEvent(event),
    });
  }

  // QCF fonts use glyph codepoints that need innerHTML rendering
  if (isQcf) {
    return (
      <span
        className={`mushaf-word ${textClass}`}
        data-highlighted={highlighted}
        data-phrase-color-index={phraseColorIndex ?? undefined}
        data-word-tap-target="true"
        data-word-tap-verse-key={word.verseKey}
        data-word-tap-word-index={wordIndex >= 0 ? wordIndex : undefined}
        data-word-tap-char-type={word.charTypeName}
        data-verse-key={word.verseKey}
        style={style}
        onClick={handleTap}
        dangerouslySetInnerHTML={{ __html: word.text }}
      />
    );
  }

  return (
    <span
      className={`mushaf-word ${textClass}`}
      data-highlighted={highlighted}
      data-phrase-color-index={phraseColorIndex ?? undefined}
      data-word-tap-target="true"
      data-word-tap-verse-key={word.verseKey}
      data-word-tap-word-index={wordIndex >= 0 ? wordIndex : undefined}
      data-word-tap-char-type={word.charTypeName}
      data-verse-key={word.verseKey}
      style={style}
      onClick={handleTap}
    >
      {word.text}
    </span>
  );
}

export const MushafWord = React.memo(MushafWordInner);
