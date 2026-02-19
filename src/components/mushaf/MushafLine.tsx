"use client";

import React from "react";
import type { MushafLine as MushafLineType, MushafCode } from "@/lib/types";
import { MushafWord } from "@/components/mushaf/MushafWord";

interface MushafLineProps {
  line: MushafLineType;
  mushafCode: MushafCode;
  pageNum: number;
  onWordTap: (verseKey: string) => void;
  highlightedVerse?: string | null;
}

function MushafLineInner({
  line,
  mushafCode,
  pageNum,
  onWordTap,
  highlightedVerse,
}: MushafLineProps) {
  return (
    <div className="mushaf-line">
      {line.words.map((word, idx) => (
        <MushafWord
          key={`${word.verseKey}-${idx}`}
          word={word}
          mushafCode={mushafCode}
          pageNum={pageNum}
          onTap={onWordTap}
          highlighted={highlightedVerse === word.verseKey}
        />
      ))}
    </div>
  );
}

export const MushafLine = React.memo(MushafLineInner);
