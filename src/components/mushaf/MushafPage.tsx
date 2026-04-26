"use client";

import React from "react";
import type { MushafPagePayload, MushafCode, Chapter } from "@/lib/types";
import { MUSHAF_LINES } from "@/lib/types";
import { MushafLine } from "@/components/mushaf/MushafLine";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import { Bismillah } from "@/components/mushaf/Bismillah";
import type { OnWordTap } from "@/lib/wordTap";

interface MushafPageProps {
  pageData: MushafPagePayload;
  mushafCode: MushafCode;
  onWordTap: OnWordTap;
  highlightedVerse?: string | null;
  chapters?: Chapter[];
  fontReady: boolean;
  showFontSkeleton: boolean;
  nextPageData?: MushafPagePayload | null;
}

function MushafPageInner({
  pageData,
  mushafCode,
  onWordTap,
  highlightedVerse,
  chapters,
  fontReady,
  showFontSkeleton,
  nextPageData,
}: MushafPageProps) {
  const maxLines = MUSHAF_LINES[mushafCode] ?? 15;
  const isSpecialPage = pageData.page === 1 || pageData.page === 2;
  const renderedChildren = [];
  const linesByNumber = new Map(pageData.lines.map((l) => [l.lineNumber, l]));
  const hasExplicitCenteredMetadata = pageData.lines.some((line) => typeof line.centered === "boolean");

  function getLegacyOpeningVerseLineTargets() {
    return [];
  }

  // Detect which surahs start on this page, and which lines need
  // headers, bismillah, and centered alignment.
  const surahsStartingOnPage: {
    chapter: Chapter;
    headerLineTarget: number;
    bismillahLineTarget: number | null;
    openingVerseLineTargets: number[];
  }[] = [];

  if (chapters?.length && pageData.lines.length) {
    const lineStarts = pageData.lines
      .filter((l) => l.words.length > 0 && l.words[0].verseKey)
      .map((l) => ({
        lineNumber: l.lineNumber,
        surahId: parseInt(l.words[0].verseKey!.split(":")[0], 10),
        verseId: parseInt(l.words[0].verseKey!.split(":")[1], 10),
      }));

    for (const start of lineStarts) {
      if (start.verseId === 1) {
        const chapter = chapters.find((c) => c.id === start.surahId);
        if (chapter) {
          const needsBismillah = chapter.bismillahPre && chapter.id !== 9;

          let headerLineTarget = -1;
          let bismillahLineTarget = null;

          if (needsBismillah) {
            bismillahLineTarget = start.lineNumber - 1;
            headerLineTarget = start.lineNumber - 2;
          } else {
            headerLineTarget = start.lineNumber - 1;
          }

          const openingVerseLineTargets = getLegacyOpeningVerseLineTargets();

          surahsStartingOnPage.push({
            chapter,
            headerLineTarget,
            bismillahLineTarget,
            openingVerseLineTargets,
          });
        }
      }
    }
  }

  // Check if the next page starts with verse 1 of a surah at line 1 or 2.
  // If so, the header (and bismillah) belong on the current page's last lines.
  if (chapters?.length && nextPageData?.lines.length) {
    const nextFirstLine = nextPageData.lines
      .filter((l) => l.words.length > 0 && l.words[0].verseKey)
      .sort((a, b) => a.lineNumber - b.lineNumber)[0];

    if (nextFirstLine) {
      const parts = nextFirstLine.words[0].verseKey!.split(":");
      const surahId = parseInt(parts[0], 10);
      const verseId = parseInt(parts[1], 10);

      if (verseId === 1 && nextFirstLine.lineNumber <= 2) {
        const chapter = chapters.find((c) => c.id === surahId);
        if (chapter) {
          const needsBismillah = chapter.bismillahPre && chapter.id !== 9;
          // The first verse line is on the next page starting at nextFirstLine.lineNumber.
          // Lines before it (header, bismillah) overflow onto this page's end.
          // Offset from page boundary: next page line 1 = this page line maxLines+1,
          // next page line 2 = this page line maxLines+2, etc.
          const firstVerseAbsolute = maxLines + nextFirstLine.lineNumber;
          let headerLineTarget: number;
          let bismillahLineTarget: number | null = null;

          if (needsBismillah) {
            bismillahLineTarget = firstVerseAbsolute - 1; // = maxLines + nextFirstLine.lineNumber - 1
            headerLineTarget = firstVerseAbsolute - 2;
          } else {
            headerLineTarget = firstVerseAbsolute - 1;
          }

          const openingVerseLineTargets: number[] = [];

          // Only add if any of these targets land within this page's line range
          if (
            headerLineTarget <= maxLines ||
            (bismillahLineTarget !== null && bismillahLineTarget <= maxLines) ||
            openingVerseLineTargets.length > 0
          ) {
            surahsStartingOnPage.push({
              chapter,
              headerLineTarget,
              bismillahLineTarget,
              openingVerseLineTargets,
            });
          }
        }
      }
    }
  }

  // Build a set of line numbers that should be centered.
  // Pages 1-2 (Al-Fatiha / start of Al-Baqarah) have all lines centered.
  // Newer generated assets carry explicit per-line `centered` metadata, but the
  // printed mushaf's short opening ayah lines after the bismillah are a separate
  // presentation rule and still need to be applied on top.
  const centeredLines = new Set<number>();
  if (pageData.page === 1 || pageData.page === 2) {
    for (let ln = 1; ln <= maxLines; ln++) centeredLines.add(ln);
  } else {
    if (hasExplicitCenteredMetadata) {
      for (const line of pageData.lines) {
        if (line.centered) centeredLines.add(line.lineNumber);
      }
    }

    for (const s of surahsStartingOnPage) {
      if (s.headerLineTarget > 0) centeredLines.add(s.headerLineTarget);
      if (s.bismillahLineTarget != null) centeredLines.add(s.bismillahLineTarget);
      for (const lineNumber of s.openingVerseLineTargets) centeredLines.add(lineNumber);
    }
  }

  // Build per-verse word offsets: for each line, track how many word-type tokens
  // have already appeared in earlier lines for each verse key. This lets MushafLine
  // assign correct 0-based morphology indices even when a verse spans multiple lines.
  const verseWordOffsetsByLine: Record<number, Record<string, number>> = {};
  const runningVerseWordCounts: Record<string, number> = {};
  for (const textLine of pageData.lines.slice().sort((a, b) => a.lineNumber - b.lineNumber)) {
    verseWordOffsetsByLine[textLine.lineNumber] = { ...runningVerseWordCounts };
    for (const word of textLine.words) {
      if (word.charTypeName === "word") {
        runningVerseWordCounts[word.verseKey] = (runningVerseWordCounts[word.verseKey] ?? 0) + 1;
      }
    }
  }

  // Slot height is 10.8% of --mushaf-page-width — chosen so slot/font
  // works out to exactly 2.0 (half ink, half leading per line) given the
  // font divisor 17.6 and line-width 0.95×pageWidth. 15 stacked slots form
  // an ink-area of aspect ≈ 1.70 — more elongated than printed-mushaf 1.5,
  // a trade-off chosen to keep generous per-line leading with a larger,
  // more readable font. Special pages (1, 2) use the same slot height so
  // the page renders at the standard mushaf height; their fewer-than-15
  // content lines render vertically centered via the parent's
  // justifyContent: center.
  const slotClass = "flex items-center justify-center shrink-0 h-[calc(var(--mushaf-page-width)*0.108)]";

  // Build the per-slot output in the natural i = 1..maxLines order.
  // For special pages (1 & 2) we count the real content slots and pad
  // with equal empty slots above and below so the content sits visually
  // centered between same-size blank lines top and bottom — flex
  // justify-content: center cannot do this on its own because the 15
  // explicit-height slots already fill the page exactly.
  const contentChildren: React.ReactNode[] = [];

  for (let i = 1; i <= maxLines; i++) {
    const textLine = linesByNumber.get(i);

    if (textLine) {
      contentChildren.push(
        <div key={`line-${i}`} className={slotClass}>
          <MushafLine
            line={textLine}
            mushafCode={mushafCode}
            pageNum={pageData.page}
            onWordTap={onWordTap}
            highlightedVerse={highlightedVerse}
            fontReady={fontReady}
            showFontSkeleton={showFontSkeleton}
            centered={centeredLines.has(i)}
            verseWordOffsets={verseWordOffsetsByLine[i]}
          />
        </div>
      );
    } else {
      const targetSurah = surahsStartingOnPage.find(
        (s) => s.headerLineTarget === i || s.bismillahLineTarget === i
      );

      if (targetSurah?.headerLineTarget === i) {
        contentChildren.push(
          <div key={`empty-${i}`} className={slotClass} onClick={(e) => e.stopPropagation()}>
            <SurahHeader
              nameSimple={targetSurah.chapter.nameSimple}
              surahNumber={targetSurah.chapter.id}
              variant="mushaf"
              showBismillah={false}
            />
          </div>
        );
      } else if (targetSurah?.bismillahLineTarget === i) {
        contentChildren.push(
          <div key={`empty-${i}`} className={slotClass} onClick={(e) => e.stopPropagation()}>
            <Bismillah className="h-4/6 w-auto max-w-[70vw] text-[var(--color-text)] opacity-90 mx-auto" />
          </div>
        );
      } else if (!isSpecialPage) {
        // Regular pages: empty filler slot in the natural i position.
        contentChildren.push(<div key={`empty-${i}`} className={slotClass} onClick={(e) => e.stopPropagation()} />);
      }
      // Special pages: SKIP empty slot — we'll append balanced padding below.
    }
  }

  if (isSpecialPage) {
    const emptyCount = maxLines - contentChildren.length;
    const padTop = Math.floor(emptyCount / 2);
    const padBottom = emptyCount - padTop;
    const padTopSlots = Array.from({ length: padTop }, (_, k) => (
      <div key={`pad-top-${k}`} className={slotClass} aria-hidden="true" />
    ));
    const padBottomSlots = Array.from({ length: padBottom }, (_, k) => (
      <div key={`pad-bottom-${k}`} className={slotClass} aria-hidden="true" />
    ));
    renderedChildren.push(...padTopSlots, ...contentChildren, ...padBottomSlots);
  } else {
    renderedChildren.push(...contentChildren);
  }

  return (
    <div className="mushaf-page relative flex flex-col justify-between">
      {renderedChildren}
      <div className="page-number flex-shrink-0 h-4">{pageData.page}</div>
    </div>
  );
}

export const MushafPage = React.memo(MushafPageInner);
export default MushafPage;
