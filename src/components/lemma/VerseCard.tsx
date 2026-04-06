"use client";

import { useState } from "react";
import { type MushafWord as MushafWordType, type MushafCode, type TranslationId } from "@/lib/types";
import type { Chapter, UserPreferences } from "@/lib/types";
import { useTranslations } from "@/hooks/useTranslations";
import { usePreferences } from "@/hooks/usePreferences";
import { ArabicVerseBlock } from "@/components/ayah/ArabicVerseBlock";
import { TranslationBlock } from "@/components/ayah/TranslationBlock";
import { NotesSheet } from "@/components/ayah/NotesSheet";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { vbvPath } from "@/lib/url";
import type { OnWordTap } from "@/lib/wordTap";
import { loadAbuIyaadNotes, type AbuIyaadNote } from "@/lib/translations/abu-iyaad";
import { useMountEffect } from "@/hooks/useMountEffect";

const NOOP = () => {};

type VerseViewPreferences = UserPreferences & { inlineVerseNotes?: boolean };

/**
 * Renders a single verse: Arabic text + translations.
 *
 * Block layout used by both VBV reader and occurrence/search pages.
 * When `showVerseLink` is true, a link to the VBV reader is shown.
 * Words can be supplied via `words` + `pageNum` (VBV, occurrence pages)
 * or omitted so ArabicVerseBlock self-fetches.
 */
export function VerseCard({
    verseKey,
    mushafCode,
    fontReady,
    onWordTap,
    words: wordsProp,
    pageNum,
    showFontSkeleton = false,
    isHighlighted = false,
    chapter,
    translationIds: translationIdsProp,
    highlightedWords = [],
    showVerseLink = false,
}: {
    verseKey: string;
    mushafCode: MushafCode;
    fontReady: boolean;
    onWordTap?: OnWordTap;
    /** Pre-supplied words. When absent, ArabicVerseBlock fetches internally. */
    words?: MushafWordType[];
    /** Single page number for all supplied words. */
    pageNum?: number;
    showFontSkeleton?: boolean;
    /** Highlight the entire verse row. */
    isHighlighted?: boolean;
    /** Pass to show a surah header before ayah 1. */
    chapter?: Chapter;
    /** Translation IDs from parent. Falls back to prefs when absent. */
    translationIds?: TranslationId[];
    /** Word indices to highlight (1-based, lemma/root). */
    highlightedWords?: number[];
    /** Show a link to open this verse in the VBV reader. */
    showVerseLink?: boolean;
}) {
    const [abuIyaadNotes, setAbuIyaadNotes] = useState<AbuIyaadNote[] | null>(null);
    const [notesSheetOpen, setNotesSheetOpen] = useState(false);
    const { prefs } = usePreferences();
    const versePrefs = prefs as VerseViewPreferences;
    const inlineVerseNotes = !!versePrefs.inlineVerseNotes;

    useMountEffect(() => {
        let active = true;
        setAbuIyaadNotes(null);

        loadAbuIyaadNotes(verseKey)
            .then((notes) => {
                if (active) setAbuIyaadNotes(notes);
            })
            .catch(() => {
                if (active) setAbuIyaadNotes([]);
            });

        return () => {
            active = false;
        };
    });

    const translationIds = (translationIdsProp ?? prefs.translationIds) as TranslationId[];
    const translations = useTranslations(verseKey, translationIds);

    const handleWordTap = onWordTap ?? NOOP;
    const fontScale = prefs.fontScale ?? 1;

    const [surahNum, ayahNum] = (() => {
        const parts = verseKey.split(":");
        return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    })();
    const hasNotes = (abuIyaadNotes?.length ?? 0) > 0;

    return (
        <div
            className="border-b border-muted/1 px-4 py-8"
            style={{ contentVisibility: "auto", containIntrinsicBlockSize: "auto 200px" }}
            data-highlighted={isHighlighted}
            data-verse-key={verseKey}
        >
            {ayahNum === 1 && chapter && (
                <div className="mb-10">
                    <SurahHeader
                        nameSimple={chapter.nameSimple}
                        surahNumber={chapter.id}
                        variant="viewer"
                        showBismillah={!!chapter.bismillahPre && chapter.id !== 1 && chapter.id !== 9}
                    />
                </div>
            )}

            {showVerseLink && (
                <div className="mb-3 flex items-center gap-1.5" dir="ltr">
                    <Link
                        href={vbvPath("s", surahNum, verseKey)}
                        className="inline-flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                        aria-label={`Open ${verseKey} in reader`}
                    >
                        <span className="text-sm font-semibold">{verseKey}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                </div>
            )}

            <ArabicVerseBlock
                verseKey={verseKey}
                mushafCode={mushafCode}
                words={wordsProp}
                pageNum={pageNum}
                onWordTap={handleWordTap}
                isHighlighted={isHighlighted}
                fontReady={fontReady}
                showFontSkeleton={showFontSkeleton}
                fontScale={fontScale}
                enableVerseTap={false}
                highlightedWords={highlightedWords}
            />

            <div
                className="w-full space-y-5"
                style={{ fontSize: `clamp(0.85rem, ${fontScale * 0.04 + 0.75}rem, 1.2rem)` }}
            >
                {translationIds.map((id) => {
                    const t = translations[id];
                    if (!t || t.loading) {
                        return (
                            <div
                                key={id}
                                className={`h-6 w-3/4 rounded ${t?.showSkeleton ? "animate-pulse bg-[var(--color-muted)]/10" : "bg-transparent"}`}
                                aria-label={t?.showSkeleton ? "Loading translation" : undefined}
                            />
                        );
                    }
                    if (!t.content?.plain) return null;
                    return (
                        <div key={id}>
                            <TranslationBlock
                                id={id}
                                content={t.content}
                                verseKey={verseKey}
                                textClassName="text-[1.05em] font-medium leading-relaxed"
                                labelClassName="text-xs font-semibold text-[var(--color-muted)] tracking-[0.14em] opacity-60 [font-variant-caps:small-caps]"
                            />
                        </div>
                    );
                })}
            </div>

            {hasNotes && (
                inlineVerseNotes ? (
                    <VerseNotesInline notes={abuIyaadNotes ?? []} />
                ) : (
                    <VerseNotesButton onOpen={() => setNotesSheetOpen(true)} />
                )
            )}

            {!inlineVerseNotes && hasNotes && (
                <NotesSheet
                    open={notesSheetOpen}
                    verseKey={verseKey}
                    onClose={() => setNotesSheetOpen(false)}
                />
            )}
        </div>
    );
}

function VerseNotesButton({
    onOpen,
}: {
    onOpen: () => void;
}) {
    return (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] opacity-60 [font-variant-caps:small-caps]">
            <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)] active:opacity-70"
                aria-label="Open notes"
            >
                <FileText className="h-3.5 w-3.5" />
                <span>Notes</span>
            </button>
        </div>
    );
}

function VerseNotesInline({
    notes,
}: {
    notes: AbuIyaadNote[];
}) {
    return (
        <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] opacity-60 [font-variant-caps:small-caps]">
                <FileText className="h-3.5 w-3.5" />
                <span>Notes</span>
            </div>

            <div className="space-y-3">
                {notes.map((note) => (
                    <article
                        key={`${note.noteId ?? "note"}:${note.number}`}
                        className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-3 py-3"
                    >
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/10 px-2 text-xs font-semibold text-[var(--color-accent)]">
                                {note.number}
                            </span>
                            {note.noteId && (
                                <a
                                    href={`https://www.thenoblequran.com/q/#/note/${note.noteId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-[var(--color-accent)]"
                                    aria-label="Open original note source"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>Source</span>
                                </a>
                            )}
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
                ))}
            </div>
        </div>
    );
}
