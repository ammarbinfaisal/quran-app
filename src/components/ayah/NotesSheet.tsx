"use client";

import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { loadAbuIyaadNotes, type AbuIyaadNote } from "@/lib/translations/abu-iyaad";

export function NotesSheet({
  open,
  verseKey,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<AbuIyaadNote[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !verseKey) {
      if (!open) {
        setNotes(null);
      }
      return;
    }

    let active = true;
    setLoading(true);

    loadAbuIyaadNotes(verseKey)
      .then((data) => {
        if (active) setNotes(data);
      })
      .catch(() => {
        if (active) setNotes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, verseKey]);

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
            {verseKey && (
              <div className="text-xs text-[var(--color-muted)]">
                {verseKey}
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
              <article
                key={`${note.noteId ?? "note"}:${note.number}`}
                className="rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-4"
              >
                <div className="mb-3 flex items-center gap-2 text-[var(--color-muted)]">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/10 px-2 text-xs font-semibold text-[var(--color-accent)]">
                    {note.number}
                  </span>
                  <FileText className="h-4 w-4" />
                </div>

                <p className="text-sm leading-7 text-[var(--color-text)]">
                  {note.text}
                </p>

                {(note.author || note.reference) && (
                  <div className="mt-4 space-y-1 text-xs text-[var(--color-muted)]">
                    {note.author && <div className="font-semibold text-[var(--color-text)]">{note.author}</div>}
                    {note.reference && <div>{note.reference}</div>}
                  </div>
                )}

                {(note.addedBy || note.addedOn) && (
                  <div className="mt-3 text-[11px] text-[var(--color-muted)]">
                    {note.addedBy ? `Added by ${note.addedBy}` : "Added"}
                    {note.addedOn ? ` on ${note.addedOn}` : ""}
                  </div>
                )}
              </article>
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
