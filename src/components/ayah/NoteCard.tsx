"use client";

import { ExternalLink, FileText } from "lucide-react";
import { getAbuIyaadNoteUrl, type AbuIyaadNote } from "@/lib/translations/abu-iyaad";

export function NoteCard({ note }: { note: AbuIyaadNote }) {
  const sourceUrl = getAbuIyaadNoteUrl(note.noteId);

  return (
    <article className="rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center gap-2 text-[var(--color-muted)]">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/10 px-2 text-xs font-semibold text-[var(--color-accent)]">
          {note.number}
        </span>
        <FileText className="h-4 w-4" />
      </div>

      <p className="text-sm leading-7 text-[var(--color-text)]">{note.text}</p>

      {(note.author || note.reference) && (
        <div className="mt-4 space-y-1 text-xs text-[var(--color-muted)]">
          {note.author && <div className="font-semibold text-[var(--color-text)]">{note.author}</div>}
          {note.reference && <div>{note.reference}</div>}
        </div>
      )}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
          aria-label={`Open original source for note ${note.number}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Original source</span>
        </a>
      )}

      {(note.addedBy || note.addedOn) && (
        <div className="mt-3 text-[11px] text-[var(--color-muted)]">
          {note.addedBy ? `Added by ${note.addedBy}` : "Added"}
          {note.addedOn ? ` on ${note.addedOn}` : ""}
        </div>
      )}
    </article>
  );
}
