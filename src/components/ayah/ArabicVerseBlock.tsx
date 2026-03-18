"use client";

import { useEffect, useMemo, useState } from "react";
import { type MushafWord as MushafWordType, type MushafCode, QCF_CODES } from "@/lib/types";
import { fetchVersePages } from "@/lib/navigation/maps";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { getFontFamily, isFontLoaded, isQcfCode, loadQcfFont, loadUnicodeFont } from "@/lib/mushaf/fonts";
import { MushafWord } from "@/components/mushaf/MushafWord";
import { getTapAnchorFromEvent, type OnWordTap } from "@/lib/wordTap";

const NOOP = () => {};

type WordWithPage = MushafWordType & { pageNum: number };

export interface PhraseHighlightRange {
  from: number;
  to: number;
  colorIndex?: number;
}

export function ArabicVerseBlock({
  verseKey,
  mushafCode,
  words: wordsProp,
  pageNum,
  fontReady,
  showFontSkeleton,
  onWordTap,
  isHighlighted = false,
  fontScale = 1,
  label = verseKey,
  labelDir = "ltr",
  labelClassName = "text-xs font-bold text-muted tabular-nums border border-muted/20 px-2 py-0.5 rounded shadow-sm",
  phraseHighlightRanges = [],
  compact = false,
}: {
  verseKey: string;
  mushafCode: MushafCode;
  words?: MushafWordType[];
  pageNum?: number;
  fontReady?: boolean;
  showFontSkeleton?: boolean;
  onWordTap?: OnWordTap;
  isHighlighted?: boolean;
  fontScale?: number;
  label?: string;
  labelDir?: "rtl" | "ltr" | "auto";
  labelClassName?: string;
  phraseHighlightRanges?: PhraseHighlightRange[];
  compact?: boolean;
}) {
  const [fetchedWords, setFetchedWords] = useState<WordWithPage[] | null>(null);
  const [internalFontReady, setInternalFontReady] = useState<boolean>(() => {
    if (pageNum == null) return !isQcfCode(mushafCode);
    return isFontLoaded(getFontFamily(mushafCode, pageNum));
  });
  const [internalShowFontSkeleton, setInternalShowFontSkeleton] = useState(false);

  const words = useMemo<WordWithPage[] | null>(() => {
    if (wordsProp !== undefined) {
      return wordsProp.map((word) => ({ ...word, pageNum: pageNum ?? 0 }));
    }
    return fetchedWords;
  }, [fetchedWords, pageNum, wordsProp]);

  useEffect(() => {
    if (wordsProp !== undefined) return;

    let active = true;

    async function load() {
      try {
        const pagesMap = await fetchVersePages(mushafCode);
        const pageLookup = pagesMap[verseKey];
        if (!pageLookup) throw new Error("not found");

        const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
        const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
        const collected: WordWithPage[] = [];

        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
          const pageData = await loadMushafPage(mushafCode, currentPage);
          for (const line of pageData.lines) {
            for (const word of line.words) {
              if (word.verseKey === verseKey) {
                collected.push({ ...word, pageNum: currentPage });
              }
            }
          }
        }

        if (active) setFetchedWords(collected);
      } catch {
        if (active) setFetchedWords([]);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [mushafCode, verseKey, wordsProp]);

  useEffect(() => {
    if (fontReady !== undefined) {
      setInternalFontReady(fontReady);
      setInternalShowFontSkeleton(showFontSkeleton ?? false);
      return;
    }

    let active = true;
    let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadFonts() {
      if (words === null) {
        setInternalFontReady(!isQcfCode(mushafCode));
        return;
      }

      const pages = Array.from(new Set(words.map((word) => word.pageNum).filter((value) => value > 0)));
      if (pages.length === 0) {
        setInternalFontReady(true);
        setInternalShowFontSkeleton(false);
        return;
      }

      const initiallyReady = pages.every((value) => isFontLoaded(getFontFamily(mushafCode, value)));
      setInternalFontReady(initiallyReady);
      setInternalShowFontSkeleton(false);

      if (!initiallyReady) {
        skeletonTimer = setTimeout(() => {
          if (active) setInternalShowFontSkeleton(true);
        }, 140);
      }

      try {
        if (isQcfCode(mushafCode)) {
          await Promise.all(pages.map((value) => loadQcfFont(mushafCode, value)));
        } else {
          await loadUnicodeFont(mushafCode);
        }

        if (!active) return;
        if (skeletonTimer) clearTimeout(skeletonTimer);
        setInternalFontReady(true);
        setInternalShowFontSkeleton(false);
      } catch {
        if (!active) return;
        if (skeletonTimer) clearTimeout(skeletonTimer);
        setInternalFontReady(true);
        setInternalShowFontSkeleton(false);
      }
    }

    loadFonts();
    return () => {
      active = false;
      if (skeletonTimer) clearTimeout(skeletonTimer);
    };
  }, [fontReady, mushafCode, showFontSkeleton, words]);

  const resolvedFontReady = fontReady ?? internalFontReady;
  const resolvedShowFontSkeleton = showFontSkeleton ?? internalShowFontSkeleton;
  const handleWordTap = onWordTap ?? NOOP;
  const isUnicode = !(QCF_CODES as readonly string[]).includes(mushafCode);

  const morphIndices = useMemo(() => {
    if (!words) return [];
    let next = 0;
    return words.map((word) => (word.charTypeName !== "word" ? -1 : next++));
  }, [words]);

  const phraseColorIndices = useMemo(() => {
    if (!words || phraseHighlightRanges.length === 0) return new Array<number | null>(words?.length ?? 0).fill(null);

    return words.map((_, index) => {
      const morphIndex = morphIndices[index] ?? -1;
      if (morphIndex < 0) return null;

      for (const range of phraseHighlightRanges) {
        if (morphIndex + 1 >= range.from && morphIndex + 1 <= range.to) {
          return range.colorIndex ?? 1;
        }
      }

      return null;
    });
  }, [morphIndices, phraseHighlightRanges, words]);

  const handleVerseTap = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    handleWordTap({
      verseKey,
      wordIndex: null,
      charTypeName: "verse",
      anchor: getTapAnchorFromEvent(event),
    });
  };

  return (
    <div className="mb-8 flex flex-col items-start gap-3" dir="rtl">
      <div className={labelClassName} dir={labelDir}>
        {label}
      </div>

      <div
        className={`verse-text-highlight flex w-full flex-wrap ${compact ? "gap-x-1.5 gap-y-3 leading-[2.1]" : "gap-x-2.5 gap-y-5 leading-[2.5]"} ${isUnicode ? "mushaf-line-unicode" : ""}`}
        style={{
          fontSize: compact
            ? `clamp(1rem, ${fontScale * 0.18 + 0.95}rem, 1.8rem)`
            : `clamp(1.25rem, ${fontScale * 0.35 + 1}rem, 3.5rem)`,
        }}
        data-highlighted={isHighlighted}
        onClick={handleVerseTap}
      >
        {words === null ? (
          <div className="h-10 w-full animate-pulse rounded bg-[var(--color-muted)]/10" />
        ) : (
          words.map((word, index) => {
            const morphIndex = morphIndices[index] ?? -1;
            return (
              <MushafWord
                key={`${word.verseKey}-${index}`}
                word={word}
                wordIndex={morphIndex}
                mushafCode={mushafCode}
                pageNum={word.pageNum}
                onTap={handleWordTap}
                highlighted={false}
                phraseColorIndex={phraseColorIndices[index] ?? null}
                fontReady={resolvedFontReady}
                showFontSkeleton={resolvedShowFontSkeleton}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
