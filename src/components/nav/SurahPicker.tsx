"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { getChapters, getPageForVerse } from "@/lib/chapters";
import SurahList from "@/components/nav/SurahList";
import VersePicker from "@/components/nav/VersePicker";

interface SurahPickerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: number, verseKey: string) => void;
}

export default function SurahPicker({ open, onClose, onNavigate }: SurahPickerProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Chapter | null>(null);

  useEffect(() => {
    if (!open) return;
    if (chapters.length) return;
    setLoading(true);
    getChapters()
      .then(setChapters)
      .catch(() => setChapters([]))
      .finally(() => setLoading(false));
  }, [chapters.length, open]);

  useEffect(() => {
    if (!open) {
      setFilter("");
      setSelected(null);
    }
  }, [open]);

  const title = useMemo(() => (selected ? "Choose verse" : "Go to surah"), [selected]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 top-0 z-50 mx-auto flex h-[85vh] max-w-xl flex-col overflow-hidden rounded-b-2xl bg-[var(--color-surface)] shadow-lg"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-muted)]/20">
          <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selected && (
          <div className="px-4 py-3 border-b border-[var(--color-muted)]/20">
            <label className="relative block">
              <span className="sr-only">Search surah</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search by number or name…"
                className="w-full rounded-lg bg-[var(--color-bg)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-muted)]/20 focus:ring-[var(--color-accent)]/40"
              />
            </label>
            {loading && (
              <p className="mt-2 text-xs text-[var(--color-muted)]">Loading…</p>
            )}
          </div>
        )}

        {selected ? (
          <VersePicker
            chapter={selected}
            onBack={() => setSelected(null)}
            onSelect={(verseNum) => {
              const page = getPageForVerse(chapters, selected.id, verseNum);
              onNavigate(page, `${selected.id}:${verseNum}`);
            }}
          />
        ) : (
          <SurahList
            chapters={chapters}
            filter={filter}
            onSelect={(ch) => setSelected(ch)}
          />
        )}
      </div>
    </>
  );
}
