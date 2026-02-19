"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, X, Loader2 } from "lucide-react";
import type { TranslationId } from "@/lib/types";
import { useTranslation } from "@/hooks/useTranslation";
import { fetchUthmaniText } from "@/lib/api";

export function AyahSheet({
  open,
  verseKey,
  translationId,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  translationId: TranslationId;
  onClose: () => void;
}) {
  const activeVerseKey = open ? verseKey : null;
  const { text: translationText, loading: translationLoading } = useTranslation(
    activeVerseKey,
    translationId,
  );

  const [uthmani, setUthmani] = useState<string>("");
  const [uthmaniLoading, setUthmaniLoading] = useState(false);

  useEffect(() => {
    if (!open || !verseKey) {
      setUthmani("");
      setUthmaniLoading(false);
      return;
    }

    let cancelled = false;
    setUthmaniLoading(true);
    fetchUthmaniText(verseKey)
      .then((t) => {
        if (!cancelled) setUthmani(t);
      })
      .catch(() => {
        if (!cancelled) setUthmani("");
      })
      .finally(() => {
        if (!cancelled) setUthmaniLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, verseKey]);

  const loading = translationLoading || uthmaniLoading;
  const title = useMemo(() => (verseKey ? `Verse ${verseKey}` : "Verse"), [verseKey]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-content" data-open="true" role="dialog" aria-label={title}>
        <div className="sheet-handle" />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              {title}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              Tap Arabic/translation to copy
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <CopyRow
            label="Arabic"
            loading={uthmaniLoading}
            value={uthmani}
            emptyText="Unable to load Arabic text."
          />
          <CopyRow
            label="Translation"
            loading={translationLoading}
            value={translationText}
            emptyText="Unable to load translation."
          />
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center text-[var(--color-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
    </>
  );
}

function CopyRow({
  label,
  value,
  loading,
  emptyText,
}: {
  label: string;
  value: string;
  loading: boolean;
  emptyText: string;
}) {
  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={loading || !value}
        className="w-full text-left text-sm text-[var(--color-text)] disabled:opacity-60"
      >
        {loading ? "Loading…" : value || emptyText}
      </button>
    </div>
  );
}
