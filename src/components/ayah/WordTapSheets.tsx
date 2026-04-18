"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, BookMarked, BookOpen, Copy, FileText, Play, Search, CornerDownRight } from "lucide-react";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { FloatingWordMenu } from "@/components/ayah/FloatingWordMenu";
import { MutashabihatSheet } from "@/components/ayah/MutashabihatSheet";
import { NotesSheet } from "@/components/ayah/NotesSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { loadMutashabihatVerseMap } from "@/lib/mutashabihat";
import { loadAbuIyaadNotes } from "@/lib/translations/abu-iyaad";
import type { MushafCode, TranslationId, UserPreferences } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { buildVerseCopyText, type VerseCopyMode, type VerseCopySettings } from "@/lib/verseCopy";
import { isMorphologyTap, type WordTapTarget } from "@/lib/wordTap";
import { useRecitationPlayer } from "@/components/recitation/useRecitationPlayer";
import { showToast } from "@/lib/toast";
import { tafsirPath } from "@/lib/url";

type ActiveSheet = "translation" | "morphology" | "notes" | "mutashabihat" | null;

export function WordTapSheets({
  selectedTap,
  translationIds,
  mushafCode,
  onClose,
  onRetargetTap,
}: {
  selectedTap: WordTapTarget | null;
  translationIds: TranslationId[];
  mushafCode: MushafCode;
  onClose: () => void;
  onRetargetTap?: (target: WordTapTarget) => void;
}) {
  const router = useRouter();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasMutashabihat, setHasMutashabihat] = useState(false);
  const { prefs } = usePreferences();
  const recitation = useRecitationPlayer();
  const isRangePlaying = recitation.status !== "idle" && recitation.range !== null;

  const copyPrefs = prefs as UserPreferences & VerseCopySettings;
  const copyMode: VerseCopyMode = copyPrefs.copyVerseContentMode ?? "arabic";
  const copyTranslationIds = copyPrefs.copyTranslationIds ?? translationIds;

  // Reset state when tapped verse changes
  const prevTapRef = useRef(selectedTap);
  if (prevTapRef.current !== selectedTap) {
    prevTapRef.current = selectedTap;

    // Reset sheet/notes state and load data for new tap
    setActiveSheet(null);
    setHasNotes(false);
    setHasMutashabihat(false);

    if (selectedTap) {
      const tap = selectedTap;
      queueMicrotask(() => {
        loadAbuIyaadNotes(tap.verseKey)
          .then((notes) => setHasNotes(notes.length > 0))
          .catch(() => {});
        loadMutashabihatVerseMap()
          .then((map) => setHasMutashabihat((map[tap.verseKey]?.length ?? 0) > 0))
          .catch(() => {});
      });
    }
  }

  const buttons = useMemo(() => {
    if (!selectedTap) return [];

    const playIcon = isRangePlaying ? (
      <CornerDownRight className="h-4 w-4" />
    ) : (
      <Play className="h-4 w-4" />
    );

    const playLabel = isRangePlaying
      ? "Jump recitation to this verse"
      : "Play this verse";

    const items = [
      {
        id: "play",
        icon: playIcon,
        label: playLabel,
        onClick: () => {
          const verseKey = selectedTap.verseKey;
          if (isRangePlaying) {
            // Range is active — try to jump within the range.
            const jumped = recitation.jumpToVerseInRange(verseKey);
            if (jumped) {
              showToast(`Jumped to ayah ${verseKey}`, "success");
            } else {
              showToast(
                `Ayah ${verseKey} is outside the playing range. Open the player to change it.`,
                "warning",
              );
            }
            onClose();
          } else {
            // Single-verse playback — start audio and immediately close the
            // floating menu so the user can scroll/tap freely.
            void recitation.playVerse(verseKey);
            onClose();
          }
        },
      },
      {
        id: "copy",
        icon: <Copy className="h-4 w-4" />,
        label: "Copy verse content",
        onClick: () => {
          void (async () => {
            try {
              const text = await buildVerseCopyText({
                verseKey: selectedTap.verseKey,
                mode: copyMode,
                translationIds: copyTranslationIds,
              });
              if (text) {
                await navigator.clipboard.writeText(text);
              }
            } catch {
              // Ignore clipboard failures.
            } finally {
              onClose();
            }
          })();
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

    {
      const [s, a] = selectedTap.verseKey.split(":");
      items.push({
        id: "tafsir",
        icon: <BookMarked className="h-4 w-4" />,
        label: "Open tafsir",
        onClick: () => {
          onClose();
          router.push(tafsirPath("ibn-katheer", parseInt(s, 10), parseInt(a, 10)));
        },
      });
    }

    if (hasNotes) {
      items.push({
        id: "notes",
        icon: <FileText className="h-4 w-4" />,
        label: "Open Shaykh Abu Iyaad's notes",
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
  }, [
    copyMode,
    copyTranslationIds,
    hasMutashabihat,
    hasNotes,
    isRangePlaying,
    onClose,
    recitation,
    router,
    selectedTap,
  ]);

  if (!selectedTap) return null;

  return (
    <>
      {activeSheet === null && (
        <FloatingWordMenu
          anchor={selectedTap.anchor}
          buttons={buttons}
          onDismiss={onClose}
          onRetargetTap={onRetargetTap}
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
