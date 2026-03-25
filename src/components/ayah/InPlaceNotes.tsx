"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { NoteCard } from "@/components/ayah/NoteCard";
import { loadAbuIyaadNotes, type AbuIyaadNote } from "@/lib/translations/abu-iyaad";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { TapAnchor } from "@/lib/wordTap";

export function InPlaceNotes({
  verseKey,
  anchor,
  onDismiss,
}: {
  verseKey: string;
  anchor: TapAnchor;
  onDismiss: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<AbuIyaadNote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [style, setStyle] = useState<CSSProperties>({
    left: anchor.x,
    top: anchor.y,
    visibility: "hidden",
  });

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

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const margin = 8;
    const gap = 14;
    const rect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchor.x - rect.width / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - rect.width - margin));

    // Try to place below the anchor first, otherwise above
    let top = anchor.y + gap;
    if (top + rect.height + margin > viewportHeight) {
      top = anchor.y - rect.height - gap;
      if (top < margin) {
        top = margin;
      }
    }

    setStyle({
      left,
      top,
      visibility: "visible",
    });
  }, [anchor.x, anchor.y, loading]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} />
      <div
        ref={containerRef}
        className="fixed z-50 w-[min(340px,calc(100vw-16px))] rounded-2xl border border-[var(--color-muted)]/20 bg-[var(--color-surface)]/95 shadow-lg backdrop-blur"
        style={{ ...style, transition: "none" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Notes for ${verseKey}`}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs font-semibold text-[var(--color-muted)]">Abu Iyaad Notes</span>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-muted)]/10 active:scale-[0.96] active:opacity-80"
            aria-label="Close notes"
            style={{ transition: "none" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[300px] space-y-3 overflow-y-auto px-3 pb-3">
          {loading ? (
            <>
              <div className="h-20 rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
              <div className="h-20 rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
            </>
          ) : notes && notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard key={`${note.noteId ?? "note"}:${note.number}`} note={note} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-muted)]/25 p-4 text-center text-xs text-[var(--color-muted)]">
              No Abu Iyaad notes found for this verse.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
