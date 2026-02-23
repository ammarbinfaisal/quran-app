"use client";

import type { Chapter } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

interface VersePickerProps {
  chapter: Chapter;
  onSelect: (verseNum: number) => void;
  onBack: () => void;
}

export default function VersePicker({ chapter, onSelect, onBack }: VersePickerProps) {
  const verses = Array.from({ length: chapter.versesCount }, (_, i) => i + 1);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-muted)]/20">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full
                     active:bg-[var(--color-accent)]/10 transition-colors"
          aria-label="Back to surah list"
        >
          <ArrowLeft size={20} className="text-[var(--color-text)]" />
        </button>
        <div className="flex flex-1 items-center justify-between min-w-0">
          <span className="text-sm font-medium text-[var(--color-text)] truncate">
            {chapter.nameSimple}
          </span>
          <span className="shrink-0 text-right font-arabic text-lg text-[var(--color-text)]" dir="rtl">
            {chapter.nameArabic}
          </span>
        </div>
      </div>

      {/* Verse grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
          {verses.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onSelect(num)}
              className="flex h-11 items-center justify-center rounded-lg
                         bg-[var(--color-surface)] text-sm font-medium
                         text-[var(--color-text)]
                         active:bg-[var(--color-accent)] active:text-white
                         transition-colors"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
