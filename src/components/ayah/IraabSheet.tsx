"use client";

import { useMemo, useState } from "react";
import { BaseSheet } from "@/components/ui/BaseSheet";
import { useChapters } from "@/hooks/useChapters";
import { useMountEffect } from "@/hooks/useMountEffect";
import { formatVerseReference } from "@/lib/recitationRange";
import { loadIraabSvg } from "@/lib/tafsir/loader";

export function IraabSheet({
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
    <IraabSheetContent key={verseKey} verseKey={verseKey} onClose={onClose} />
  );
}

function IraabSheetContent({
  verseKey,
  onClose,
}: {
  verseKey: string;
  onClose: () => void;
}) {
  const chapters = useChapters();
  const [svg, setSvg] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useMountEffect(() => {
    let active = true;
    const [surahPart, ayahPart] = verseKey.split(":");
    const surah = Number.parseInt(surahPart, 10);
    const ayah = Number.parseInt(ayahPart, 10);

    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) {
      setSvg(null);
      setLoading(false);
      return;
    }

    loadIraabSvg(surah, ayah)
      .then((data) => {
        if (!active) return;
        setSvg(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSvg(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  });

  const subtitle = useMemo(() => {
    return formatVerseReference(verseKey, chapters);
  }, [chapters, verseKey]);

  return (
    <BaseSheet
      open
      onClose={onClose}
      title="Iʿraab"
      subtitle={subtitle}
      ariaLabel={`Iʿraab diagram for ${verseKey}`}
    >
      <div className="max-h-[70vh] overflow-auto pb-8">
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <div className="h-24 w-full max-w-md rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
          </div>
        ) : svg ? (
          <div
            className="iraab-svg-container w-fit [&_svg]:max-h-[70vh] [&_svg]:w-auto [&_svg]:max-w-none"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-muted)]/25 p-6 text-center text-sm text-[var(--color-muted)]">
            No iʿraab diagram is available for this verse.
          </div>
        )}
      </div>
    </BaseSheet>
  );
}
