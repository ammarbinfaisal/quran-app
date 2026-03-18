"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import {
  loadMutashabihatGroupsForVerse,
  loadMutashabihatVerseTextMap,
  type MutashabihatOccurrence,
  type MutashabihatPhraseGroup,
} from "@/lib/mutashabihat";

interface LoadedGroup {
  id: number;
  group: MutashabihatPhraseGroup;
}

type VerseTextMap = Record<string, string>;

const MAX_PHRASE_COLORS = 7;

function compareVerseKeys(a: string, b: string) {
  const [aSurah, aAyah] = a.split(":").map(Number);
  const [bSurah, bAyah] = b.split(":").map(Number);
  return aSurah - bSurah || aAyah - bAyah;
}

function buildHighlightedSegments(
  verseText: string,
  occurrences: MutashabihatOccurrence[],
  colorIndex: number,
): Array<{ text: string; colorIndex: number | null }> {
  const tokens = verseText.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const tokenColors = new Array<number | null>(tokens.length).fill(null);

  for (const occurrence of occurrences) {
    const start = Math.max(0, occurrence.from - 1);
    const end = Math.min(tokens.length - 1, occurrence.to - 1);
    for (let idx = start; idx <= end; idx++) {
      tokenColors[idx] = colorIndex;
    }
  }

  const segments: Array<{ text: string; colorIndex: number | null }> = [];
  let currentColor = tokenColors[0];
  let currentTokens = [tokens[0]];

  for (let idx = 1; idx < tokens.length; idx++) {
    if (tokenColors[idx] === currentColor) {
      currentTokens.push(tokens[idx]);
      continue;
    }

    segments.push({
      text: currentTokens.join(" "),
      colorIndex: currentColor,
    });

    currentColor = tokenColors[idx];
    currentTokens = [tokens[idx]];
  }

  segments.push({
    text: currentTokens.join(" "),
    colorIndex: currentColor,
  });

  return segments;
}

function HighlightedVerseText({
  verseText,
  occurrences,
  colorIndex,
}: {
  verseText: string;
  occurrences: MutashabihatOccurrence[];
  colorIndex: number;
}) {
  const segments = useMemo(
    () => buildHighlightedSegments(verseText, occurrences, colorIndex),
    [colorIndex, occurrences, verseText],
  );

  if (segments.length === 0) {
    return verseText;
  }

  return (
    <>
      {segments.map((segment, index) => (
        <span key={`${segment.text}-${index}`}>
          {segment.colorIndex ? (
            <span className="phrase-highlight" data-color-index={segment.colorIndex}>
              {segment.text}
            </span>
          ) : (
            segment.text
          )}
          {index < segments.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export function MutashabihatSheet({
  open,
  verseKey,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<LoadedGroup[] | null>(null);
  const [verseTexts, setVerseTexts] = useState<VerseTextMap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !verseKey) {
      if (!open) {
        setGroups(null);
      }
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      loadMutashabihatGroupsForVerse(verseKey),
      loadMutashabihatVerseTextMap(),
    ])
      .then(([groupData, verseTextData]) => {
        if (!active) return;
        setGroups(groupData);
        setVerseTexts(verseTextData);
      })
      .catch(() => {
        if (!active) return;
        setGroups([]);
        setVerseTexts({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, verseKey]);

  const sortedGroups = useMemo(() => {
    return [...(groups ?? [])].sort((a, b) => b.group.count - a.group.count || a.id - b.id);
  }, [groups]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-content" data-open="true" role="dialog" aria-label={`Mutashabihat for ${verseKey ?? "verse"}`}>
        <div className="sheet-handle" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              Similar Passages
            </div>
            {verseKey && (
              <div className="text-xs text-[var(--color-muted)]">
                {verseKey}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-[0.97] active:opacity-80"
            aria-label="Close similarities"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pb-8">
          {loading ? (
            <>
              <div className="h-32 animate-pulse rounded-xl bg-[var(--color-muted)]/10" />
              <div className="h-32 animate-pulse rounded-xl bg-[var(--color-muted)]/10" />
            </>
          ) : sortedGroups.length > 0 ? (
            sortedGroups.map(({ id, group }, groupIndex) => {
              const colorIndex = (groupIndex % MAX_PHRASE_COLORS) + 1;
              const verseEntries = (Object.entries(group.ayah) as Array<[string, MutashabihatOccurrence[]]>)
                .sort(([a], [b]) => compareVerseKeys(a, b));
              const currentFirst = verseEntries.find(([key]) => key === verseKey);
              const remaining = verseEntries.filter(([key]) => key !== verseKey);
              const orderedEntries = currentFirst ? [currentFirst, ...remaining] : verseEntries;

              return (
                <article
                  key={id}
                  className="rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <ArrowLeftRight className="h-4 w-4 text-[var(--color-accent)]" />
                      <span>{group.count} linked verses</span>
                      <span>{group.surahs} surahs</span>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--color-text)]"
                      style={{ backgroundColor: `var(--phrase-highlight-${colorIndex})` }}
                    >
                      #{id}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[var(--color-surface)] px-3 py-3" dir="rtl">
                    <div className="font-arabic text-xl leading-9 text-[var(--color-text)]">
                      <span className="phrase-highlight" data-color-index={colorIndex}>
                        {group.source.text}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--color-muted)]" dir="ltr">
                      Source: {group.source.key} ({group.source.from}-{group.source.to})
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {orderedEntries.map(([key, occurrences]) => {
                      const isActiveVerse = key === verseKey;
                      const verseText = verseTexts?.[key] ?? occurrences.map((occurrence) => occurrence.text).join(" | ");

                      return (
                        <div
                          key={key}
                          className={`rounded-xl border px-3 py-3 ${
                            isActiveVerse
                              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
                              : "border-[var(--color-muted)]/15 bg-[var(--color-surface)]/40"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-[var(--color-text)]">
                              {key}
                            </span>
                            <span className="text-[11px] text-[var(--color-muted)]">
                              {occurrences.length} match{occurrences.length === 1 ? "" : "es"}
                            </span>
                          </div>

                          <div
                            className="verse-text-highlight rounded-lg bg-[var(--color-bg)] px-3 py-3 font-arabic text-lg leading-8 text-[var(--color-text)]"
                            data-highlighted={isActiveVerse}
                            dir="rtl"
                          >
                            <HighlightedVerseText
                              verseText={verseText}
                              occurrences={occurrences}
                              colorIndex={colorIndex}
                            />
                          </div>

                          <div className="mt-2 text-[11px] text-[var(--color-muted)]" dir="ltr">
                            Matches: {occurrences.map((occurrence) => `${occurrence.from}-${occurrence.to}`).join(", ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-muted)]/25 p-6 text-center text-sm text-[var(--color-muted)]">
              No mutashabihat grouping was found for this verse.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
