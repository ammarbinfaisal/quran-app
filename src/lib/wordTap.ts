"use client";

export interface TapAnchor {
  x: number;
  y: number;
}

export interface WordTapTarget {
  verseKey: string;
  wordIndex: number | null;
  charTypeName: string;
  anchor: TapAnchor;
}

export type OnWordTap = (target: WordTapTarget) => void;

export const WORD_TAP_TARGET_SELECTOR = "[data-word-tap-target='true']";

export function isMorphologyTap(target: WordTapTarget | null): boolean {
  return target?.wordIndex != null && target.charTypeName === "word";
}

export function getTapAnchorFromEvent(event: {
  clientX: number;
  clientY: number;
  currentTarget: {
    getBoundingClientRect: () => DOMRect;
  };
}): TapAnchor {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2,
    y: Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2,
  };
}

export function getWordTapTargetFromElement(
  element: HTMLElement | null,
  point?: Partial<TapAnchor>,
): WordTapTarget | null {
  const target = element?.closest<HTMLElement>(WORD_TAP_TARGET_SELECTOR);
  if (!target) return null;

  const verseKey = target.dataset.wordTapVerseKey;
  const charTypeName = target.dataset.wordTapCharType;
  const rawWordIndex = target.dataset.wordTapWordIndex;
  if (!verseKey || !charTypeName) return null;

  const wordIndex =
    rawWordIndex == null || rawWordIndex === "" ? null : Number.parseInt(rawWordIndex, 10);
  if (rawWordIndex != null && rawWordIndex !== "" && Number.isNaN(wordIndex)) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  return {
    verseKey,
    wordIndex,
    charTypeName,
    anchor: {
      x: point?.x != null && Number.isFinite(point.x) ? point.x : rect.left + rect.width / 2,
      y: point?.y != null && Number.isFinite(point.y) ? point.y : rect.top + rect.height / 2,
    },
  };
}
