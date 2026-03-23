"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { NoteCard } from "@/components/ayah/NoteCard";
import {
  loadAbuIyaadNotes,
  type AbuIyaadNote,
} from "@/lib/translations/abu-iyaad";

export function NotesSheet({
  open,
  verseKey,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  onClose: () => void;
}) {
  const chapters = useChapters();
  const [notes, setNotes] = useState<AbuIyaadNote[] | null | undefined>(undefined);
  const [notesVerseKey, setNotesVerseKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !verseKey) return;

    let active = true;
    loadAbuIyaadNotes(verseKey)
      .then((data) => {
        if (!active) return;
        setNotes(data);
        setNotesVerseKey(verseKey);
      })
      .catch(() => {
        if (!active) return;
        setNotes([]);
        setNotesVerseKey(verseKey);
      });

    return () => {
      active = false;
    };
  }, [open, verseKey]);

  const subtitle = useMemo(() => {
    if (!open || !verseKey) return null;

    const [surahPart, ayahPart] = verseKey.split(":");
    const surahNum = Number(surahPart);
    const ayahNum = Number(ayahPart);

    if (!Number.isFinite(surahNum) || !Number.isFinite(ayahNum)) {
      return verseKey;
    }

    const surahName = chapters.find((chapter) => chapter.id === surahNum)?.nameSimple;
    const surahLabel = surahName ? `Surah ${surahName}` : `Surah ${surahNum}`;

    return `${surahLabel} - ${ayahNum}`;
  }, [chapters, open, verseKey]);

  const loading = open && !!verseKey && notesVerseKey !== verseKey;

  if (!open) return null;

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-content" data-open="true" role="dialog" aria-label={`Notes for ${verseKey ?? "verse"}`}>
        <div className="sheet-handle" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              Notes
            </div>
            {subtitle && (
              <div className="text-xs text-[var(--color-muted)]">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] transition active:scale-[0.97] active:opacity-80"
            aria-label="Close notes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pb-8">
          {loading ? (
            <>
              <div className="h-24 rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
              <div className="h-24 rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
            </>
          ) : notes && notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard key={`${note.noteId ?? "note"}:${note.number}`} note={note} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-muted)]/25 p-6 text-center text-sm text-[var(--color-muted)]">
              No Abu Iyaad notes were found for this verse.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
