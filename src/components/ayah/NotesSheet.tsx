"use client";

import { useMemo, useState } from "react";
import { BaseSheet } from "@/components/ui/BaseSheet";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { NoteCard } from "@/components/ayah/NoteCard";
import { formatVerseReference } from "@/lib/recitationRange";
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
  if (!open || !verseKey) return null;

  return (
    <NotesSheetContent key={verseKey} verseKey={verseKey} onClose={onClose} />
  );
}

function NotesSheetContent({
  verseKey,
  onClose,
}: {
  verseKey: string;
  onClose: () => void;
}) {
  const chapters = useChapters();
  const [notes, setNotes] = useState<AbuIyaadNote[] | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useMountEffect(() => {
    let active = true;
    loadAbuIyaadNotes(verseKey)
      .then((data) => {
        if (!active) return;
        setNotes(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setNotes([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  });

  const subtitle = useMemo(() => {
    return formatVerseReference(verseKey, chapters);
  }, [chapters, verseKey]);

  return (
    <BaseSheet open onClose={onClose} title="Notes" subtitle={subtitle} ariaLabel={`Notes for ${verseKey}`}>
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
            No Shaykh Abu Iyaad notes were found for this verse.
          </div>
        )}
      </div>
    </BaseSheet>
  );
}
