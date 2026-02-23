"use client";

import { useState, useEffect, useMemo } from "react";
import { type MushafWord as MushafWordType, type MushafCode } from "@/lib/types";
import { fetchVersePages } from "@/lib/navigation/maps";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { useTranslations } from "@/hooks/useTranslations";
import { usePreferences } from "@/hooks/usePreferences";
import { MushafWord } from "@/components/mushaf/MushafWord";
import { QCF_CODES, type TranslationId, TRANSLATION_DISPLAY_NAMES } from "@/lib/types";
import type { FootnoteReference, TranslationSegment } from "@/lib/footnotes";
import { FootnoteSheet } from "@/components/ayah/FootnoteSheet";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { mushafPath, vbvPath } from "@/lib/url";
import { pageToSurah, pageToJuz } from "@/lib/navigation/maps";

export function VerseCard({
    verseKey,
    highlightedWords,
    mushafCode,
    fontReady,
}: {
    verseKey: string;
    highlightedWords: number[];
    mushafCode: MushafCode;
    fontReady: boolean;
}) {
    const [words, setWords] = useState<Array<MushafWordType & { pageNum: number }> | null>(null);
    const [footnoteSheetOpen, setFootnoteSheetOpen] = useState(false);
    const [activeFootnotes, setActiveFootnotes] = useState<{ refs: FootnoteReference[]; label: string } | null>(null);
    const { prefs } = usePreferences();
    const chapters = useChapters();

    const targetTranslations = useMemo(() => {
        const ids = new Set(prefs.translationIds);
        ids.add("abu-iyaad"); // Ensure Abu Iyaad is included as requested
        return Array.from(ids) as TranslationId[];
    }, [prefs.translationIds]);

    const translations = useTranslations(verseKey, targetTranslations);

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const pagesMap = await fetchVersePages(mushafCode);
                const pageLookup = pagesMap[verseKey];
                if (!pageLookup) throw new Error("not found");

                const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
                const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;

                const collectedWords: Array<MushafWordType & { pageNum: number }> = [];
                for (let p = startPage; p <= endPage; p++) {
                    const pageData = await loadMushafPage(mushafCode, p);
                    for (const line of pageData.lines) {
                        for (const w of line.words) {
                            if (w.verseKey === verseKey) {
                                collectedWords.push({ ...w, pageNum: p });
                            }
                        }
                    }
                }
                if (active) setWords(collectedWords);
            } catch {
                if (active) setWords([]);
            }
        }
        load();
        return () => { active = false; };
    }, [verseKey, mushafCode]);

    const isUnicode = !(QCF_CODES as readonly string[]).includes(mushafCode);
    const rtlClass = isUnicode ? "mushaf-line-unicode" : "";

    // Compute verse link in user's preferred mode
    const versePage = words?.[0]?.pageNum ?? null;
    const verseLink = (() => {
        if (versePage === null) return null;
        if (prefs.viewMode === "vbv") {
            const sub = prefs.vbvSubmode ?? "s";
            if (sub === "s") return vbvPath("s", pageToSurah(versePage, chapters), verseKey);
            if (sub === "j") return vbvPath("j", pageToJuz(versePage), verseKey);
            return vbvPath("p", versePage, verseKey);
        }
        return mushafPath(versePage, verseKey);
    })();

    return (
        <div className="flex flex-col gap-6 border-b border-[var(--color-muted)]/10 pb-8 mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-1.5 shrink-0 sm:pt-2">
                    <span className="text-sm font-semibold text-[var(--color-muted)]">{verseKey}</span>
                    {verseLink && (
                        <Link
                            href={verseLink}
                            className="text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                            aria-label={`Open ${verseKey} in reader`}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>

                <div className="flex-1 w-full text-right" dir="rtl">
                    {words === null ? (
                        <div className="h-10 w-full animate-pulse bg-[var(--color-muted)]/10 rounded" />
                    ) : (
                        <div
                            className={`flex flex-wrap ${rtlClass}`}
                            style={{
                                fontSize: `clamp(1.25rem, ${(prefs.fontScale ?? 1) * 0.35 + 1}rem, 3.5rem)`,
                                lineHeight: "2.5",
                            }}
                        >
                            {words.map((w, i) => {
                                let morphIndex = -1;
                                if (w.charTypeName === "word") {
                                    morphIndex = words.slice(0, i).filter(word => word.charTypeName === "word").length;
                                }
                                return (
                                    <MushafWord
                                        key={i}
                                        word={w}
                                        wordIndex={i}
                                        mushafCode={mushafCode}
                                        pageNum={w.pageNum}
                                        onTap={() => { }}
                                        highlighted={morphIndex >= 0 && highlightedWords.includes(morphIndex + 1)}
                                        fontReady={fontReady}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 pl-0 sm:pl-10 mt-6">
                {targetTranslations.map((id) => {
                    const t = translations[id];
                    if (!t) return null;

                    if (t.loading) {
                        return (
                            <div key={id} className="space-y-2 py-1 max-w-3xl">
                                <div className="h-4 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                                <div className="h-4 w-4/5 rounded bg-[var(--color-muted)]/15 animate-pulse" />
                            </div>
                        );
                    }

                    const content = t.content;
                    const segments = content.segments;
                    const footnoteRefs: FootnoteReference[] = segments
                        .filter((s): s is Extract<TranslationSegment, { type: "footnote" }> => s.type === "footnote")
                        .map((s) => ({ id: s.id, label: s.label }));
                    const label = TRANSLATION_DISPLAY_NAMES[id] ?? id;
                    return (
                        <div key={id} className="text-sm leading-relaxed text-[var(--color-text)] opacity-90 pb-2 border-b border-[var(--color-muted)]/5 last:border-0 max-w-4xl">
                            {segments.map((part: TranslationSegment, idx: number) => {
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
                                        onClick={() => {
                                            if (footnoteRefs.length === 0) return;
                                            const ref = footnoteRefs.find((r) => r.id === part.id);
                                            setActiveFootnotes({ refs: ref ? [ref] : footnoteRefs, label });
                                            setFootnoteSheetOpen(true);
                                        }}
                                        className="inline-flex items-center justify-center px-1 text-[10px] font-bold text-[var(--color-accent)] hover:underline active:opacity-60"
                                        aria-label={`Footnote ${part.label}`}
                                    >
                                        [{part.label}]
                                    </button>
                                );
                            })}
                        </div>
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
        </div>
    );
}
