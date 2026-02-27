"use client";

import { AyahSheet } from "@/components/ayah/AyahSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import type { MushafCode, TranslationId } from "@/lib/types";

export function WordTapSheets({
  selectedVerse,
  selectedWordIndex,
  translationIds,
  mushafCode,
  onClose,
}: {
  selectedVerse: string | null;
  selectedWordIndex: number | null;
  translationIds: TranslationId[];
  mushafCode: MushafCode;
  onClose: () => void;
}) {
  return (
    <>
      <AyahSheet
        open={!!selectedVerse && selectedWordIndex === null}
        verseKey={selectedVerse}
        translationIds={translationIds}
        onClose={onClose}
      />

      <MorphologySheet
        open={!!selectedVerse && selectedWordIndex !== null}
        verseKey={selectedVerse}
        wordIndex={selectedWordIndex}
        mushafCode={mushafCode}
        onClose={onClose}
      />
    </>
  );
}
