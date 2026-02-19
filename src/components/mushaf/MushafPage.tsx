"use client";

import React from "react";
import type { MushafPagePayload, MushafCode } from "@/lib/types";
import { MushafLine } from "@/components/mushaf/MushafLine";

interface MushafPageProps {
  pageData: MushafPagePayload;
  mushafCode: MushafCode;
  onWordTap: (verseKey: string) => void;
  highlightedVerse?: string | null;
}

function MushafPageInner({
  pageData,
  mushafCode,
  onWordTap,
  highlightedVerse,
}: MushafPageProps) {
  return (
    <div className="mushaf-page">
      {pageData.lines.map((line) => (
        <MushafLine
          key={line.lineNumber}
          line={line}
          mushafCode={mushafCode}
          pageNum={pageData.page}
          onWordTap={onWordTap}
          highlightedVerse={highlightedVerse}
        />
      ))}
      <div className="page-number">{pageData.page}</div>
    </div>
  );
}

export const MushafPage = React.memo(MushafPageInner);
export default MushafPage;
