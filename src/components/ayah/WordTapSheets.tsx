"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, BookOpen, Copy, FileText, Loader2, Pause, Play, Search } from "lucide-react";
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
import { getAudioElement, pauseAudio } from "@/lib/audio";
import { playVerseAudio } from "@/lib/verseAudio";
import { useMountEffect } from "@/hooks/useMountEffect";

type ActiveSheet = "translation" | "morphology" | "notes" | "mutashabihat" | null;
type AudioState = "idle" | "loading" | "playing";

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
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const { prefs } = usePreferences();

  const copyPrefs = prefs as UserPreferences & VerseCopySettings;
  const copyMode: VerseCopyMode = copyPrefs.copyVerseContentMode ?? "arabic";
  const copyTranslationIds = copyPrefs.copyTranslationIds ?? translationIds;

  // Reset audio state when tapped verse changes, stop any playing audio.
  const prevTapRef = useRef(selectedTap);
  if (prevTapRef.current !== selectedTap) {
    prevTapRef.current = selectedTap;
    setAudioState("idle");
    pauseAudio();

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

  // Listen for the audio element's ended event to reset state.
  useMountEffect(() => {
    const el = getAudioElement();
    if (!el) return;
    const handleEnded = () => setAudioState("idle");
    el.addEventListener("ended", handleEnded);
    return () => el.removeEventListener("ended", handleEnded);
  });

  const buttons = useMemo(() => {
    if (!selectedTap) return [];

    const playIcon =
      audioState === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : audioState === "playing" ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      );

    const items = [
      {
        id: "play",
        icon: playIcon,
        label: "Play verse recitation",
        onClick: () => {
          void (async () => {
            if (audioState === "playing") {
              pauseAudio();
              setAudioState("idle");
              return;
            }
            setAudioState("loading");
            const success = await playVerseAudio(
              selectedTap.verseKey,
              prefs.ayahReciterId,
            );
            setAudioState(success ? "playing" : "idle");
          })();
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
    audioState,
    copyMode,
    copyTranslationIds,
    hasMutashabihat,
    hasNotes,
    onClose,
    prefs.ayahReciterId,
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
