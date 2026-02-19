"use client";

import type { Chapter } from "@/lib/types";

interface SurahListProps {
  chapters: Chapter[];
  filter: string;
  onSelect: (chapter: Chapter) => void;
}

export default function SurahList({ chapters, filter, onSelect }: SurahListProps) {
  const trimmed = filter.trim().toLowerCase();

  const filtered = chapters.filter((ch) => {
    if (!trimmed) return true;
    // Match against surah number
    if (String(ch.id) === trimmed) return true;
    // Match against name
    return ch.nameSimple.toLowerCase().includes(trimmed);
  });

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      {filtered.length === 0 && (
        <p className="px-4 py-8 text-center text-[var(--color-muted)] text-sm">
          No surahs found
        </p>
      )}
      {filtered.map((ch) => (
        <button
          key={ch.id}
          type="button"
          onClick={() => onSelect(ch)}
          className="flex w-full items-center gap-3 min-h-12 px-4 py-3
                     bg-[var(--color-surface)] border-b border-[var(--color-muted)]/20
                     active:opacity-70 transition-opacity text-left"
        >
          {/* Surah number */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center
                           rounded-full bg-[var(--color-accent)]/10
                           text-xs font-medium text-[var(--color-accent)]">
            {ch.id}
          </span>

          {/* Names */}
          <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-[var(--color-text)] truncate">
                {ch.nameSimple}
              </span>
              <span className="text-xs text-[var(--color-muted)]">
                {ch.versesCount} verses
              </span>
            </span>
            <span className="shrink-0 text-right font-arabic text-lg text-[var(--color-text)]" dir="rtl">
              {ch.nameArabic}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
