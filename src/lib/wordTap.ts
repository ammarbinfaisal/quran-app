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
