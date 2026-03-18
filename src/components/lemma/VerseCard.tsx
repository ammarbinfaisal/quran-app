"use client";

import { useState, useEffect, useMemo } from "react";
import { type MushafWord as MushafWordType, type MushafCode, type TranslationId, QCF_CODES } from "@/lib/types";
import type { Chapter } from "@/lib/types";
import { fetchVersePages } from "@/lib/navigation/maps";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { useTranslations } from "@/hooks/useTranslations";
import { usePreferences } from "@/hooks/usePreferences";
import { MushafWord } from "@/components/mushaf/MushafWord";
import { TranslationBlock } from "@/components/ayah/TranslationBlock";
import { SurahHeader } from "@/components/mushaf/SurahHeader";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { vbvPath } from "@/lib/url";
import { getTapAnchorFromEvent, type OnWordTap } from "@/lib/wordTap";

const NOOP = () => {};

type WordWithPage = MushafWordType & { pageNum: number };

/**
 * Renders a single verse: Arabic text + translations.
 *
 * Two layout variants driven by `showVerseLink`:
 *   - true  → "card" layout (lemma / root / search): verse key links to VBV,
 *             Arabic on the right, translations below. Words fetched internally.
 *   - false → "block" layout (VBV reader): full-width RTL, verse key badge,
 *             optional surah header. Words supplied via `words` + `pageNum`.
 */
export function VerseCard({
    verseKey,
    mushafCode,
    fontReady,
    onWordTap,
    // Block (VBV) props
    words: wordsProp,
    pageNum,
    showFontSkeleton = false,
    isHighlighted = false,
    chapter,
    translationIds: translationIdsProp,
    // Card (lemma/root/search) props
    highlightedWords = [],
    showVerseLink = false,
}: {
    verseKey: string;
    mushafCode: MushafCode;
    fontReady: boolean;
    onWordTap?: OnWordTap;
    /** Pre-supplied words (VBV). When absent, words are fetched internally. */
    words?: MushafWordType[];
    /** Single page number for all supplied words (VBV). */
    pageNum?: number;
    showFontSkeleton?: boolean;
    /** Highlight the entire verse row (VBV). */
    isHighlighted?: boolean;
    /** Pass to show a surah header before ayah 1 (VBV). */
    chapter?: Chapter;
    /** Translation IDs from parent (VBV). Falls back to prefs when absent. */
    translationIds?: TranslationId[];
    /** Word indices to highlight (1-based, lemma/root). */
    highlightedWords?: number[];
    /** Show a link to open this verse in the VBV reader (card layout). */
    showVerseLink?: boolean;
}) {
    const [fetchedWords, setFetchedWords] = useState<WordWithPage[] | null>(null);
    const { prefs } = usePreferences();

    // Normalise words to always carry pageNum
    const words = useMemo<WordWithPage[] | null>(() => {
        if (wordsProp !== undefined) {
            return wordsProp.map(w => ({ ...w, pageNum: pageNum ?? 0 }));
        }
        return fetchedWords;
    }, [wordsProp, pageNum, fetchedWords]);

    // Only fetch when words aren't supplied (card mode)
    useEffect(() => {
        if (wordsProp !== undefined) return;
        let active = true;
        async function load() {
            try {
                const pagesMap = await fetchVersePages(mushafCode);
                const pageLookup = pagesMap[verseKey];
                if (!pageLookup) throw new Error("not found");
                const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
                const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
                const collected: WordWithPage[] = [];
                for (let p = startPage; p <= endPage; p++) {
                    const pageData = await loadMushafPage(mushafCode, p);
                    for (const line of pageData.lines) {
                        for (const w of line.words) {
                            if (w.verseKey === verseKey) collected.push({ ...w, pageNum: p });
                        }
                    }
                }
                if (active) setFetchedWords(collected);
            } catch {
                if (active) setFetchedWords([]);
            }
        }
        load();
        return () => { active = false; };
    }, [verseKey, mushafCode, wordsProp]);

    const translationIds = (translationIdsProp ?? prefs.translationIds) as TranslationId[];
    const translations = useTranslations(verseKey, translationIds);

    const isUnicode = !(QCF_CODES as readonly string[]).includes(mushafCode);
    const handleWordTap = onWordTap ?? NOOP;
    const fontScale = prefs.fontScale ?? (showVerseLink ? 1 : 3);
    const handleVerseTap = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        handleWordTap({
            verseKey,
            wordIndex: null,
            charTypeName: "verse",
            anchor: getTapAnchorFromEvent(event),
        });
    };

    const morphIndices = useMemo(() => {
        if (!words) return [];
        let next = 0;
        return words.map(w => (w.charTypeName !== "word" ? -1 : next++));
    }, [words]);

    const [surahNum, ayahNum] = useMemo(() => {
        const parts = verseKey.split(":");
        return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    }, [verseKey]);

    // ── CARD LAYOUT (lemma / root / search) ────────────────────────────────
    if (showVerseLink) {
        return (
            <div className="flex flex-col gap-6 border-b border-[var(--color-muted)]/10 pb-8 mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-center gap-1.5 shrink-0 sm:pt-2">
                        <Link
                            href={vbvPath("s", surahNum, verseKey)}
                            className="inline-flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                            aria-label={`Open ${verseKey} in reader`}
                        >
                            <span className="text-sm font-semibold">{verseKey}</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="flex-1 w-full text-right" dir="rtl">
                        {words === null ? (
                            <div className="h-10 w-full animate-pulse bg-[var(--color-muted)]/10 rounded" />
                        ) : (
                            <div
                                className={`flex flex-wrap ${isUnicode ? "mushaf-line-unicode" : ""}`}
                                style={{ fontSize: `clamp(1.25rem, ${fontScale * 0.35 + 1}rem, 3.5rem)`, lineHeight: "2.5" }}
                                onClick={handleVerseTap}
                            >
                                {words.map((w, i) => {
                                    const morphIndex = morphIndices[i] ?? -1;
                                    return (
                                        <MushafWord
                                            key={i}
                                            word={w}
                                            wordIndex={morphIndex}
                                            mushafCode={mushafCode}
                                            pageNum={w.pageNum}
                                            onTap={handleWordTap}
                                            highlighted={morphIndex >= 0 && highlightedWords.includes(morphIndex + 1)}
                                            fontReady={fontReady}
                                            showFontSkeleton={fontReady}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4 pl-0 sm:pl-10 mt-6">
                    {translationIds.map((id) => {
                        const t = translations[id];
                        if (!t) return null;
                        if (t.loading) {
                            return (
                                <div key={id} className="space-y-2 py-1 max-w-3xl">
                                    <div className={`h-4 w-full rounded ${t.showSkeleton ? "bg-[var(--color-muted)]/15 animate-pulse" : "bg-transparent"}`} />
                                    <div className={`h-4 w-4/5 rounded ${t.showSkeleton ? "bg-[var(--color-muted)]/15 animate-pulse" : "bg-transparent"}`} />
                                </div>
                            );
                        }
                        if (!t.content?.plain) return null;
                        return (
                            <div key={id} className="pb-2 border-b border-[var(--color-muted)]/5 last:border-0 max-w-4xl">
                                <TranslationBlock
                                    id={id}
                                    content={t.content}
                                    verseKey={verseKey}
                                    textClassName="text-sm leading-relaxed"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── BLOCK LAYOUT (VBV reader) ───────────────────────────────────────────
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

            <div className="flex flex-col items-start gap-3 mb-8" dir="rtl">
                <div className="text-xs font-bold text-muted tabular-nums border border-muted/20 px-2 py-0.5 rounded shadow-sm">
                    {verseKey}
                </div>
                <div
                    className="verse-text-highlight flex w-full flex-wrap gap-x-2.5 gap-y-5 leading-[2.5]"
                    style={{ fontSize: `clamp(1.25rem, ${fontScale * 0.35 + 1}rem, 3.5rem)` }}
                    data-highlighted={isHighlighted}
                    onClick={handleVerseTap}
                >
                    {words === null ? (
                        <div className="h-10 w-full animate-pulse bg-[var(--color-muted)]/10 rounded" />
                    ) : (
                        words.map((w, i) => {
                            const morphIndex = morphIndices[i] ?? -1;
                            return (
                                <MushafWord
                                    key={`${w.verseKey}-${i}`}
                                    word={w}
                                    wordIndex={morphIndex}
                                    mushafCode={mushafCode}
                                    pageNum={w.pageNum}
                                    onTap={handleWordTap}
                                    highlighted={false}
                                    fontReady={fontReady}
                                    showFontSkeleton={showFontSkeleton}
                                />
                            );
                        })
                    )}
                </div>
            </div>

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
        </div>
    );
}
