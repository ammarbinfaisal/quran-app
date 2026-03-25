"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import type { FootnoteReference } from "@/lib/footnotes";
import { loadTranslationFootnotes } from "@/lib/footnotes";
import { fetchFootnote } from "@/lib/api";
import { useMountEffect } from "@/hooks/useMountEffect";

interface FootnoteSheetProps {
    open: boolean;
    onClose: () => void;
    footnoteRefs: FootnoteReference[];
    translationLabel: string;
}

export function FootnoteSheet({
    open,
    onClose,
    footnoteRefs,
    translationLabel,
}: FootnoteSheetProps) {
    if (!open || footnoteRefs.length === 0) return null;
    if (typeof document === "undefined") return null;

    return (
        <FootnoteSheetContent
            key={footnoteRefs.map((r) => r.id).join(",")}
            onClose={onClose}
            footnoteRefs={footnoteRefs}
            translationLabel={translationLabel}
        />
    );
}

function FootnoteSheetContent({
    onClose,
    footnoteRefs,
    translationLabel,
}: {
    onClose: () => void;
    footnoteRefs: FootnoteReference[];
    translationLabel: string;
}) {
    const [footnoteTexts, setFootnoteTexts] = useState<Record<string, string>>(
        {},
    );
    const [loading, setLoading] = useState(true);

    useMountEffect(() => {
        let cancelled = false;

        async function loadFootnotes() {
            const results: Record<string, string> = {};

            // Try bundled footnotes first
            const bundled = await loadTranslationFootnotes();

            for (const ref of footnoteRefs) {
                // Check all translation keys in bundled data
                for (const translationData of Object.values(bundled)) {
                    if (translationData?.[ref.id]) {
                        results[ref.id] = translationData[ref.id];
                        break;
                    }
                }

                // If not found in bundled data, fetch from API
                if (!results[ref.id]) {
                    const text = await fetchFootnote(ref.id);
                    if (text) results[ref.id] = text;
                }
            }

            if (!cancelled) {
                setFootnoteTexts(results);
                setLoading(false);
            }
        }

        loadFootnotes();

        return () => {
            cancelled = true;
        };
    });

    const node = (
        <>
            <div className="sheet-overlay" style={{ zIndex: 60 }} onClick={onClose} />
            <div
                className="sheet-content"
                style={{ zIndex: 70, maxHeight: "50vh" }}
                data-open="true"
                role="dialog"
                aria-label={`${translationLabel} Footnotes`}
            >
                <div className="sheet-handle" />

                <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text)]">
                            Footnotes
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                            {translationLabel}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
                        aria-label="Close footnotes"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3 pb-8">
                    {loading ? (
                        <div className="flex items-center justify-center py-6 text-[var(--color-muted)]">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        footnoteRefs.map((ref, index) => {
                            const text = footnoteTexts[ref.id];
                            return (
                                <div
                                    key={`${ref.id}-${index}`}
                                    className="rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-3"
                                >
                                    <div className="flex gap-2 text-sm text-[var(--color-text)]">
                                        <span className="shrink-0 font-semibold text-[var(--color-accent)]">
                                            [{ref.label || String(index + 1)}]
                                        </span>
                                        <span
                                            className="leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html: text || "Footnote text unavailable",
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );

    return createPortal(node, document.body);
}
