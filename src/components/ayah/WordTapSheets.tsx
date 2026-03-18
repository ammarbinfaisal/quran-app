"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, BookOpen, Copy, FileText, Search } from "lucide-react";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { FloatingWordMenu } from "@/components/ayah/FloatingWordMenu";
import { MutashabihatSheet } from "@/components/ayah/MutashabihatSheet";
import { NotesSheet } from "@/components/ayah/NotesSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { fetchUthmaniText } from "@/lib/api";
import { loadMutashabihatVerseMap } from "@/lib/mutashabihat";
import { loadAbuIyaadNotes } from "@/lib/translations/abu-iyaad";
import type { MushafCode, TranslationId } from "@/lib/types";
import { isMorphologyTap, type WordTapTarget } from "@/lib/wordTap";

type ActiveSheet = "translation" | "morphology" | "notes" | "mutashabihat" | null;

export function WordTapSheets({
  selectedTap,
  translationIds,
  mushafCode,
  onClose,
}: {
  selectedTap: WordTapTarget | null;
  translationIds: TranslationId[];
  mushafCode: MushafCode;
  onClose: () => void;
}) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasMutashabihat, setHasMutashabihat] = useState(false);

  useEffect(() => {
    setActiveSheet(null);
    setHasNotes(false);
    setHasMutashabihat(false);

    if (!selectedTap) return;

    let active = true;

    loadAbuIyaadNotes(selectedTap.verseKey)
      .then((notes) => {
        if (active) setHasNotes(notes.length > 0);
      })
      .catch(() => {});

    loadMutashabihatVerseMap()
      .then((map) => {
        if (active) setHasMutashabihat((map[selectedTap.verseKey]?.length ?? 0) > 0);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedTap]);

  const buttons = useMemo(() => {
    if (!selectedTap) return [];

    const items = [
      {
        id: "copy",
        icon: <Copy className="h-4 w-4" />,
        label: "Copy Uthmani verse text",
        onClick: async () => {
          try {
            const text = await fetchUthmaniText(selectedTap.verseKey);
            if (text) {
              await navigator.clipboard.writeText(text);
            }
          } catch {
            // Ignore clipboard failures.
          } finally {
            onClose();
          }
        },
      },
    ];

    if (isMorphologyTap(selectedTap)) {
      items.push({
        id: "morphology",
        icon: <Search className="h-4 w-4" />,
        label: "Open root and lemma sheet",
        onClick: () => setActiveSheet("morphology"),
      });
    }

    items.push({
      id: "translation",
      icon: <BookOpen className="h-4 w-4" />,
      label: "Open translation sheet",
      onClick: () => setActiveSheet("translation"),
    });

    if (hasNotes) {
      items.push({
        id: "notes",
        icon: <FileText className="h-4 w-4" />,
        label: "Open Abu Iyaad notes",
        onClick: () => setActiveSheet("notes"),
      });
    }

    if (hasMutashabihat) {
      items.push({
        id: "mutashabihat",
        icon: <ArrowLeftRight className="h-4 w-4" />,
        label: "Open similar passages",
        onClick: () => setActiveSheet("mutashabihat"),
      });
    }

    return items;
  }, [hasMutashabihat, hasNotes, onClose, selectedTap]);

  if (!selectedTap) return null;

  return (
    <>
      {activeSheet === null && (
        <FloatingWordMenu
          anchor={selectedTap.anchor}
          buttons={buttons}
          onDismiss={onClose}
        />
      )}

      <AyahSheet
        open={activeSheet === "translation"}
        verseKey={selectedTap.verseKey}
        translationIds={translationIds}
        onClose={onClose}
      />

      <MorphologySheet
        open={activeSheet === "morphology"}
        verseKey={selectedTap.verseKey}
        wordIndex={selectedTap.wordIndex}
        mushafCode={mushafCode}
        onClose={onClose}
      />

      <NotesSheet
        open={activeSheet === "notes"}
        verseKey={selectedTap.verseKey}
        onClose={onClose}
      />

      <MutashabihatSheet
        open={activeSheet === "mutashabihat"}
        verseKey={selectedTap.verseKey}
        onClose={onClose}
      />
    </>
  );
}
