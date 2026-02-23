"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { buckwalterToArabic } from "@/lib/transliteration";
import { lemmaPath } from "@/lib/url";
import type { MushafCode } from "@/lib/types";
import { useChapters } from "@/hooks/useChapters";
import { dbGet } from "@/lib/offline/storage";

// ---------------------------------------------------------------------------
// POS full-name map
// ---------------------------------------------------------------------------
const POS_NAMES: Record<string, string> = {
    V: "Verb",
    N: "Noun",
    PN: "Proper noun",
    P: "Preposition",
    DET: "Determiner",
    ADJ: "Adjective",
    CONJ: "Conjunction",
    PRON: "Pronoun",
    REL: "Relative pronoun",
    DEM: "Demonstrative",
    COND: "Conditional",
    NEG: "Negative",
    INTG: "Interrogative",
    RES: "Restriction",
    CERT: "Certainty",
    ANS: "Answer",
    PREV: "Preventive",
    VOC: "Vocative",
    EXP: "Exceptive",
    SUP: "Supplementary",
    AMD: "Amendment",
    INC: "Inceptive",
    SUR: "Surprise",
    AVR: "Aversion",
    RET: "Retraction",
    SUB: "Subordinating conjunction",
    ACC: "Accusative particle",
    CIRC: "Circumstantial",
    COM: "Comitative",
    EQ: "Equalization",
    EMPH: "Emphatic",
    FUT: "Future",
    IMPV: "Imperative",
    INL: "Interjectional",
    LOC: "Location",
};

// ---------------------------------------------------------------------------
// POS color palette (CSS variable names mapped to classes)
// ---------------------------------------------------------------------------
const POS_COLORS: Record<string, { dot: string; text: string }> = {
    V:    { dot: "bg-[var(--pos-verb)]",       text: "var(--pos-verb)" },
    N:    { dot: "bg-[var(--pos-noun)]",       text: "var(--pos-noun)" },
    PRON: { dot: "bg-[var(--pos-pronoun)]",    text: "var(--pos-pronoun)" },
    P:    { dot: "bg-[var(--pos-prep)]",       text: "var(--pos-prep)" },
    DET:  { dot: "bg-[var(--pos-det)]",        text: "var(--pos-det)" },
    ADJ:  { dot: "bg-[var(--pos-adj)]",        text: "var(--pos-adj)" },
    CONJ: { dot: "bg-[var(--pos-conj)]",       text: "var(--pos-conj)" },
    PN:   { dot: "bg-[var(--pos-propn)]",      text: "var(--pos-propn)" },
};

const DEFAULT_COLOR = { dot: "bg-[var(--color-muted)]", text: "var(--color-muted)" };

function getPosColor(pos: string) {
    return POS_COLORS[pos] ?? DEFAULT_COLOR;
}

function getPosName(pos: string): string {
    return POS_NAMES[pos] ?? pos;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MorphologyData {
    segment: number;
    form: string;
    pos: string;
    features: Record<string, string> & { flags?: string[] };
}

// ---------------------------------------------------------------------------
// Fetch helper: try IndexedDB cache first, then network
// ---------------------------------------------------------------------------

import { fetchVersePages } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";

function getJuzForPage(page: number): number {
    for (const jp of JUZ_PAGE_RANGES) {
        if (page >= jp.pages[0] && page <= jp.pages[1]) return jp.juz;
    }
    return 1;
}

async function fetchMorphologyData(
    surah: number,
    ayah: number,
    wordIndex: number,
): Promise<MorphologyData[]> {
    const key = `${surah}:${ayah}:${wordIndex}`;

    // Try IndexedDB cached juz chunk first
    try {
        const versePages = await fetchVersePages("v2");
        const vk = `${surah}:${ayah}`;
        const pageLookup = versePages[vk];
        if (pageLookup != null) {
            const page = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
            const juz = getJuzForPage(page);
            const juzStr = String(juz).padStart(2, "0");
            const chunk = await dbGet<Record<string, MorphologyData[]>>("morphology", `juz-${juzStr}`);
            if (chunk && key in chunk) {
                return chunk[key];
            }
        }
    } catch {
        // IndexedDB unavailable or not downloaded — fall through to network
    }

    // Network fallback: fetch full morphology.json
    const res = await fetch("/data/morphology.json");
    const allData = await res.json();
    return allData[key] || [];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MorphologySheet({
    open,
    verseKey,
    wordIndex,
    onClose,
}: {
    open: boolean;
    verseKey: string | null;
    wordIndex: number | null;
    mushafCode: MushafCode;
    onClose: () => void;
}) {
    const [data, setData] = useState<MorphologyData[] | null>(null);
    const [loading, setLoading] = useState(false);
    const chapters = useChapters();

    useEffect(() => {
        if (!open || !verseKey || wordIndex === null) {
            if (!open) {
                setTimeout(() => setData(null), 300);
            }
            return;
        }

        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const [surah, ayah] = verseKey.split(":").map(Number);
                const result = await fetchMorphologyData(surah, ayah, wordIndex + 1);
                if (mounted) setData(result);
            } catch (err) {
                console.error("Failed to fetch morphology", err);
                if (mounted) setData([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();
        return () => { mounted = false; };
    }, [open, verseKey, wordIndex]);

    if (!open) return null;

    // Build title with surah name
    const [surahId, ayahId] = (verseKey ?? "").split(":").map(Number);
    const chapter = chapters.find((c) => c.id === surahId);
    const surahName = chapter?.nameSimple ?? `Surah ${surahId || ""}`;
    const title = verseKey
        ? `${surahName} ${surahId}:${ayahId}:${wordIndex !== null ? wordIndex + 1 : ""}`
        : "Morphology";

    // Collect unique POS types for legend
    const uniquePos = data
        ? [...new Set(data.map((s) => s.pos))]
        : [];

    // Collect lemma and root from all segments
    const lemmaRaw = data?.find((s) => s.features.lem)?.features.lem?.replace(/[{}]/g, "") ?? null;
    const lemma = lemmaRaw ? buckwalterToArabic(lemmaRaw) : null;
    const rootRaw = data?.find((s) => s.features.root)?.features.root ?? null;
    const root = rootRaw ? buckwalterToArabic(rootRaw) : null;

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

                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-3">
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

                <div className="space-y-5 pb-8 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="space-y-3">
                            <div className="h-10 w-3/4 mx-auto rounded bg-[var(--color-muted)]/15 animate-pulse" />
                            <div className="h-16 w-full rounded bg-[var(--color-muted)]/15 animate-pulse" />
                        </div>
                    ) : data && data.length > 0 ? (
                        <>
                            {/* POS Legend */}
                            <div className="flex flex-wrap gap-3">
                                {uniquePos.map((pos) => {
                                    const color = getPosColor(pos);
                                    return (
                                        <div key={pos} className="flex items-center gap-1.5 text-xs text-[var(--color-text)]">
                                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.dot}`} />
                                            <span>{getPosName(pos)}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Colored word display — single connected Arabic word */}
                            <div className="text-center py-4" dir="rtl">
                                <span className="font-arabic text-4xl leading-relaxed">
                                    {data.map((segment) => {
                                        const color = getPosColor(segment.pos);
                                        return (
                                            <span
                                                key={segment.segment}
                                                style={{ color: color.text }}
                                            >
                                                {buckwalterToArabic(segment.form)}
                                            </span>
                                        );
                                    })}
                                </span>
                            </div>

                            {/* Lemma & Root row */}
                            {(lemma || root) && (
                                <div className="flex items-center justify-center gap-6 rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 py-3">
                                    {lemma && (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Lemma</span>
                                            <Link
                                                href={lemmaPath(lemmaRaw!)}
                                                onClick={onClose}
                                                className="inline-flex items-center gap-1 font-arabic text-lg text-[var(--color-accent)] font-medium"
                                            >
                                                {lemma}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    )}
                                    {lemma && root && (
                                        <div className="h-8 w-px bg-[var(--color-muted)]/20" />
                                    )}
                                    {root && (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Root</span>
                                            <span className="font-arabic text-lg font-medium text-[var(--color-text)]">{root}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center text-[var(--color-muted)] py-8 text-sm">
                            No morphology data available for this word.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
