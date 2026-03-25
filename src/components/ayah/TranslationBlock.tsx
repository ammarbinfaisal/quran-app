"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { type TranslationId, TRANSLATION_DISPLAY_NAMES } from "@/lib/types";
import type { TranslationSegment, FootnoteReference } from "@/lib/footnotes";
import { FootnoteSheet } from "@/components/ayah/FootnoteSheet";

export function TranslationBlock({
    id,
    content,
    verseKey,
    textClassName = "text-sm leading-relaxed",
    labelClassName = "text-xs font-bold text-[var(--color-muted)] uppercase tracking-[0.09em] opacity-60",
}: {
    id: TranslationId;
    content: { segments: TranslationSegment[]; plain: string };
    verseKey: string;
    textClassName?: string;
    labelClassName?: string;
}) {
    const [copied, setCopied] = useState(false);
    const [footnoteSheetOpen, setFootnoteSheetOpen] = useState(false);
    const [activeFootnotes, setActiveFootnotes] = useState<{ refs: FootnoteReference[]; label: string } | null>(null);

    const label = TRANSLATION_DISPLAY_NAMES[id] ?? id;
    const { segments, plain } = content;

    const footnoteRefs: FootnoteReference[] = segments
        .filter((s): s is Extract<TranslationSegment, { type: "footnote" }> => s.type === "footnote")
        .map((s) => ({ id: s.id, label: s.label }));

    const [surahNumStr, ayahNumStr] = verseKey.split(":");
    const surahNum = Number(surahNumStr);
    const ayahNum = Number(ayahNumStr);

    function handleCopy() {
        navigator.clipboard.writeText(plain).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <>
            <div className={`${labelClassName} mb-2 flex items-center gap-2`}>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 hover:opacity-100 transition-opacity"
                    aria-label={`Copy ${label} translation`}
                >
                    {copied ? (
                        <Check className="h-3 w-3 text-[var(--color-accent)] shrink-0" />
                    ) : (
                        <Copy className="h-3 w-3 text-[var(--color-muted)] shrink-0" />
                    )}
                    <span>{label}</span>
                </button>
                {id === "abu-iyaad" &&
                    Number.isFinite(surahNum) &&
                    Number.isFinite(ayahNum) && (
                        <a
                            href={`https://www.thenoblequran.com/q/#/verse/${surahNum}/${ayahNum}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:text-[var(--color-accent)] transition-colors"
                            aria-label="Open Shaykh Abu Iyaad's translation source"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
            </div>

            <div className={`${textClassName} text-[var(--color-text)]`}>
                {segments.map((part: TranslationSegment, idx: number) => {
                    if (part.type === "text") {
                        return <span key={idx}>{part.text}</span>;
                    }
                    if (part.type === "annotation") {
                        return (
                            <span key={idx} className="text-[var(--color-annotation)]">
                                {part.text}
                            </span>
                        );
                    }
                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                if (footnoteRefs.length === 0) return;
                                const ref = footnoteRefs.find((r) => r.id === part.id);
                                setActiveFootnotes({ refs: ref ? [ref] : footnoteRefs, label });
                                setFootnoteSheetOpen(true);
                            }}
                            className="inline-flex select-none items-center justify-center px-1 text-[10px] font-bold text-[var(--color-accent)] hover:underline active:opacity-60"
                            aria-label={`Footnote ${part.label}`}
                        >
                            [{part.label}]
                        </button>
                    );
                })}
            </div>

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
