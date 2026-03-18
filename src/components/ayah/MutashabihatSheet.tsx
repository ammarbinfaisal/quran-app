"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import Link from "next/link";
import { ArabicVerseBlock, type PhraseHighlightRange } from "@/components/ayah/ArabicVerseBlock";
import { useChapters } from "@/hooks/useChapters";
import { usePreferences } from "@/hooks/usePreferences";
import {
  loadMutashabihatGroupsForVerse,
  type MutashabihatOccurrence,
  type MutashabihatPhraseGroup,
} from "@/lib/mutashabihat";
import { vbvPath } from "@/lib/url";

interface LoadedGroup {
  id: number;
  group: MutashabihatPhraseGroup;
}

const MAX_PHRASE_COLORS = 7;

function compareVerseKeys(a: string, b: string) {
  const [aSurah, aAyah] = a.split(":").map(Number);
  const [bSurah, bAyah] = b.split(":").map(Number);
  return aSurah - bSurah || aAyah - bAyah;
}

function getSurahLabel(verseKey: string, surahName: string | undefined) {
  const [surah, ayah] = verseKey.split(":");
  return `Surah ${surahName ?? surah} - ${ayah}`;
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
  const chapters = useChapters();
  const { prefs } = usePreferences();
  const [groups, setGroups] = useState<LoadedGroup[] | null>(null);
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

    loadMutashabihatGroupsForVerse(verseKey)
      .then((groupData) => {
        if (!active) return;
        setGroups(groupData);
      })
      .catch(() => {
        if (!active) return;
        setGroups([]);
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
  const activeSurahName = verseKey
    ? chapters.find((chapter) => chapter.id === Number.parseInt(verseKey.split(":")[0] ?? "0", 10))?.nameSimple
    : undefined;

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
                {getSurahLabel(verseKey, activeSurahName)}
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
                  <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <ArrowLeftRight className="h-4 w-4 text-[var(--color-accent)]" />
                    <span>{group.count} linked verses</span>
                    <span>{group.surahs} surahs</span>
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
                      const surahId = Number.parseInt(key.split(":")[0] ?? "0", 10);
                      const surahName = chapters.find((chapter) => chapter.id === surahId)?.nameSimple;
                      const highlightRanges: PhraseHighlightRange[] = occurrences.map((occurrence) => ({
                        from: occurrence.from,
                        to: occurrence.to,
                        colorIndex,
                      }));

                      return (
                        <Link
                          key={key}
                          href={vbvPath("s", surahId, key)}
                          onClick={onClose}
                          className={`rounded-xl border px-3 py-3 ${
                            isActiveVerse
                              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
                              : "border-[var(--color-muted)]/15 bg-[var(--color-surface)]/40"
                          } block`}
                          aria-label={`Open ${getSurahLabel(key, surahName)}`}
                        >
                          <ArabicVerseBlock
                            verseKey={key}
                            mushafCode={prefs.mushafCode}
                            label={getSurahLabel(key, surahName)}
                            isHighlighted={isActiveVerse}
                            phraseHighlightRanges={highlightRanges}
                            fontScale={prefs.fontScale}
                            compact
                            labelClassName="text-xs font-semibold text-[var(--color-text)]"
                          />
                        </Link>
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
