"use client";

import React from "react";
import type { MushafWord as MushafWordType, MushafCode } from "@/lib/types";
import { getFontFamily } from "@/lib/mushaf/fonts";

interface MushafWordProps {
  word: MushafWordType;
  mushafCode: MushafCode;
  pageNum: number;
  onTap: (verseKey: string) => void;
  highlighted: boolean;
}

function MushafWordInner({
  word,
  mushafCode,
  pageNum,
  onTap,
  highlighted,
}: MushafWordProps) {
  const style: React.CSSProperties = {
    fontFamily: getFontFamily(mushafCode, pageNum),
  };

  return (
    <span
      className="mushaf-word mushaf-text"
      data-highlighted={highlighted}
      style={style}
      onClick={() => onTap(word.verseKey)}
    >
      {word.text}
    </span>
  );
}

export const MushafWord = React.memo(MushafWordInner);
