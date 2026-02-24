"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, X, Check, BookOpen, ExternalLink } from "lucide-react";
import { TRANSLATION_DISPLAY_NAMES, type TranslationId } from "@/lib/types";
import { useTranslations } from "@/hooks/useTranslations";
import { fetchUthmaniText } from "@/lib/api";
import type { FootnoteReference, TranslationSegment } from "@/lib/footnotes";
import { ABU_IYAAD_KEYS } from "@/lib/translations/abuIyaadKeys";
import { FootnoteSheet } from "./FootnoteSheet";

export function AyahSheet({
  open,
  verseKey,
  translationIds,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  translationIds: TranslationId[];
  onClose: () => void;
}) {
  const activeVerseKey = open ? verseKey : null;
  const filteredTranslationIds = useMemo(() => {
    return translationIds.filter((id) => {
      if (id === "abu-iyaad" && activeVerseKey && !ABU_IYAAD_KEYS.has(activeVerseKey)) {
        return false;
      }
      return true;
    });
  }, [translationIds, activeVerseKey]);

  const translations = useTranslations(activeVerseKey, filteredTranslationIds);

  const [copiedArabic, setCopiedArabic] = useState(false);
  const [footnoteSheetOpen, setFootnoteSheetOpen] = useState(false);
  const [activeFootnotes, setActiveFootnotes] = useState<{
    refs: FootnoteReference[];
    label: string;
  } | null>(null);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCopiedArabic(false);
        setFootnoteSheetOpen(false);
        setActiveFootnotes(null);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset copied indicator
  useEffect(() => {
    if (!copiedArabic) return;
    const t = setTimeout(() => setCopiedArabic(false), 900);
    return () => clearTimeout(t);
  }, [copiedArabic]);

  // Extract footnote references per translation from pre-parsed segments
  const translationFootnoteRefs = useMemo(() => {
    const map: Partial<Record<TranslationId, FootnoteReference[]>> = {};
    for (const id of filteredTranslationIds) {
      const segments = translations[id]?.content?.segments ?? [];
      const refs: FootnoteReference[] = segments
        .filter((s): s is Extract<TranslationSegment, { type: "footnote" }> => s.type === "footnote")
        .map((s) => ({ id: s.id, label: s.label }));
      if (refs.length > 0) {
        map[id] = refs;
      }
    }
    return map;
  }, [filteredTranslationIds, translations]);

  const title = verseKey ? `Verse ${verseKey}` : "Verse";

  if (!open) return null;

  async function handleCopyArabic() {
    if (!verseKey) return;
    try {
      const text = await fetchUthmaniText(verseKey);
      if (text) {
        await navigator.clipboard.writeText(text);
        setCopiedArabic(true);
      }
    } catch { /* ignore */ }
  }

  function openFootnotes(id: TranslationId, specificRef?: FootnoteReference) {
    const refs = translationFootnoteRefs[id];
    if (!refs || refs.length === 0) return;

    setActiveFootnotes({
      refs: specificRef ? [specificRef] : refs,
      label: TRANSLATION_DISPLAY_NAMES[id] ?? id,
    });
    setFootnoteSheetOpen(true);
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div
        className="sheet-content"
        data-open="true"
        role="dialog"
        aria-label={title}
      >
        <div className="sheet-handle" />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 pb-8">
          {/* Wide Copy Arabic button */}
          <button
            type="button"
            onClick={handleCopyArabic}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-4 py-3 text-sm font-medium text-[var(--color-text)] active:scale-[0.99] transition"
          >
            {copiedArabic ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-[var(--color-muted)]" />
                <span>Copy Arabic Text</span>
              </>
            )}
          </button>

          {/* Translation rows */}
          {filteredTranslationIds.map((id) => {
            const data = translations[id];
            const label = TRANSLATION_DISPLAY_NAMES[id] || id;
            const isLoading = data?.loading ?? true;
            const showSkeleton = data?.showSkeleton ?? isLoading;
            const content = data?.content;
            const hasFootnotes = (translationFootnoteRefs[id]?.length ?? 0) > 0;

            // Don't show Abu Iyaad row if loading is done and text is empty
            if (!isLoading && !content?.plain) return null;

            return (
              <TranslationRow
                key={id}
                label={label}
                showSkeleton={showSkeleton}
                content={content}
                verseKey={activeVerseKey}
                hasFootnotes={hasFootnotes}
                onViewAllFootnotes={() => openFootnotes(id)}
                onFootnoteClick={(ref) => openFootnotes(id, ref)}
              />
            );
          })}
        </div>
      </div>

      {/* Footnote sheet (2nd layer) */}
      {activeFootnotes && (
        <FootnoteSheet
          open={footnoteSheetOpen}
          onClose={() => setFootnoteSheetOpen(false)}
          footnoteRefs={activeFootnotes.refs}
          translationLabel={activeFootnotes.label}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TranslationRow — shows translation text with skeleton, copy, and footnotes
// ---------------------------------------------------------------------------

function TranslationRow({
  label,
  showSkeleton,
  content,
  verseKey,
  hasFootnotes,
  onViewAllFootnotes,
  onFootnoteClick,
}: {
  label: string;
  showSkeleton: boolean;
  content: import("@/lib/footnotes").TranslationContent | undefined;
  verseKey?: string | null;
  hasFootnotes: boolean;
  onViewAllFootnotes: () => void;
  onFootnoteClick: (ref: FootnoteReference) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 900);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    const plain = content?.plain;
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
    } catch { /* ignore */ }
  }

  let externalLink = null;
  if (verseKey && label.includes("Abu Iyaad")) {
    const [s, a] = verseKey.split(":");
    externalLink = `https://www.thenoblequran.com/q/#/verse/${s}/${a}`;
  }

  const segments = content?.segments ?? [];

  return (
    <div className="rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3 py-2">
      {/* Header: label + actions */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </div>
        <div className="flex items-center gap-1">
          {hasFootnotes && (
            <button
              type="button"
              onClick={onViewAllFootnotes}
              className="rounded-md p-2 text-[var(--color-accent)] active:opacity-70 transition"
              aria-label={`View ${label} footnotes`}
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}

          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-2 text-[var(--color-muted)] hover:text-[var(--color-accent)] active:opacity-70 transition"
              aria-label="View on The Noble Quran"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!content?.plain}
            className="rounded-md p-2 text-[var(--color-muted)] active:opacity-70 transition disabled:opacity-30"
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content: skeleton or segmented text */}
      {showSkeleton ? (
        <div className="space-y-2 py-1" aria-label="Loading translation">
          <div className="h-3.5 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
          <div className="h-3.5 w-4/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
          <div className="h-3.5 w-3/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-[var(--color-text)]">
          {segments.map((part, idx) => {
            if (part.type === "text") {
              return <span key={idx}>{part.text}</span>;
            }
            if (part.type === "annotation") {
              return (
                <span key={idx} className="text-[var(--color-muted)] opacity-70">
                  {part.text}
                </span>
              );
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onFootnoteClick({ id: part.id, label: part.label })}
                className="inline-flex items-center justify-center px-1 text-[10px] font-bold text-[var(--color-accent)] hover:underline active:opacity-60"
                aria-label={`Footnote ${part.label}`}
              >
                [{part.label}]
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
