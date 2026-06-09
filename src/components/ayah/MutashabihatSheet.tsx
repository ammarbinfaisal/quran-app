"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { BaseSheet } from "@/components/ui/BaseSheet";
import Link from "next/link";
import { ArabicVerseBlock, type PhraseHighlightRange } from "@/components/ayah/ArabicVerseBlock";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import {
  loadMutashabihatGroupsForVerse,
  type MutashabihatOccurrence,
  type MutashabihatPhraseGroup,
} from "@/lib/mutashabihat";
import { formatVerseReference } from "@/lib/recitationRange";
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

export function MutashabihatSheet({
  open,
  verseKey,
  onClose,
}: {
  open: boolean;
  verseKey: string | null;
  onClose: () => void;
}) {
  if (!open || !verseKey) return null;

  return (
    <MutashabihatSheetContent key={verseKey} verseKey={verseKey} onClose={onClose} />
  );
}

function MutashabihatSheetContent({
  verseKey,
  onClose,
}: {
  verseKey: string;
  onClose: () => void;
}) {
  const chapters = useChapters();
  const { prefs } = usePreferences();
  const [groups, setGroups] = useState<LoadedGroup[] | null>(null);
  const [loading, setLoading] = useState(true);

  useMountEffect(() => {
    let active = true;

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
  });

  const sortedGroups = useMemo(() => {
    return [...(groups ?? [])].sort((a, b) => b.group.count - a.group.count || a.id - b.id);
  }, [groups]);
  return (
    <BaseSheet open onClose={onClose} title="Similar Passages" subtitle={formatVerseReference(verseKey, chapters)} ariaLabel={`Mutashabihat for ${verseKey}`}>
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

                  <div className="rounded-xl bg-[var(--color-surface)] px-2 py-2">
                    <ArabicVerseBlock
                      verseKey={group.source.key}
                      mushafCode={prefs.mushafCode}
                      phraseHighlightRanges={[{ from: group.source.from, to: group.source.to, colorIndex }]}
                      fontScale={prefs.fontScale}
                      compact
                      label={formatVerseReference(group.source.key, chapters)}
                      labelClassName="text-xs font-semibold text-[var(--color-muted)]"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {orderedEntries.map(([key, occurrences]) => {
                      const isActiveVerse = key === verseKey;
                      const surahId = Number.parseInt(key.split(":")[0] ?? "0", 10);
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
                          aria-label={`Open ${formatVerseReference(key, chapters)}`}
                        >
                          <ArabicVerseBlock
                            verseKey={key}
                            mushafCode={prefs.mushafCode}
                            label={formatVerseReference(key, chapters)}
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
    </BaseSheet>
  );
}
