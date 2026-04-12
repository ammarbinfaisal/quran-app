"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, BookOpen, Copy, FileText, Loader2, Pause, Play, Search, FastForward } from "lucide-react";
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
import { useMountEffect } from "@/hooks/useMountEffect";
import { useRecitationPlayer } from "@/components/recitation/useRecitationPlayer";

type ActiveSheet = "translation" | "morphology" | "notes" | "mutashabihat" | "play-options" | null;
type AudioState = "idle" | "loading" | "playing";

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
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasMutashabihat, setHasMutashabihat] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>("idle");
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
    setAudioState("idle");

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

    // Determine play button behavior based on recitation state
    const playIcon =
      audioState === "loading" || recitation.status === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recitation.status === "playing" && recitation.currentVerse === selectedTap.verseKey ? (
        <Pause className="h-4 w-4" />
      ) : isRangePlaying ? (
        <FastForward className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      );

    const playLabel = isRangePlaying
      ? "Continue from this verse"
      : "Play verse recitation";

    const items = [
      {
        id: "play",
        icon: playIcon,
        label: playLabel,
        onClick: () => {
          if (isRangePlaying) {
            // Show options: play single or continue from here
            setActiveSheet("play-options");
          } else {
            // Play single verse
            void (async () => {
              setAudioState("loading");
              await recitation.playVerse(selectedTap.verseKey);
              setAudioState("idle");
            })();
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
    isRangePlaying,
    onClose,
    recitation,
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

      <PlayOptionsSheet
        open={activeSheet === "play-options"}
        verseKey={selectedTap.verseKey}
        onClose={onClose}
        onPlaySingle={() => {
          void recitation.playVerse(selectedTap.verseKey);
          onClose();
        }}
        onContinueFromHere={() => {
          // Continue range from this verse
          if (recitation.range) {
            const verseIndex = recitation.range.verses.indexOf(selectedTap.verseKey);
            if (verseIndex >= 0) {
              // Create new range starting from this verse
              const newRange = {
                ...recitation.range,
                verses: recitation.range.verses.slice(verseIndex),
                startVerse: selectedTap.verseKey,
              };
              void recitation.playRange(newRange);
            } else {
              // Verse not in range, just play single
              void recitation.playVerse(selectedTap.verseKey);
            }
          }
          onClose();
        }}
      />
    </>
  );
}

function PlayOptionsSheet({
  open,
  verseKey,
  onClose,
  onPlaySingle,
  onContinueFromHere,
}: {
  open: boolean;
  verseKey: string;
  onClose: () => void;
  onPlaySingle: () => void;
  onContinueFromHere: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-2xl bg-[var(--color-surface)] shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="p-4">
          <div className="sheet-handle" />
          <h3 className="mt-2 text-center text-sm font-semibold text-[var(--color-text)]">
            Play from Ayah {verseKey}
          </h3>
          <p className="mt-1 text-center text-xs text-[var(--color-muted)]">
            A range is currently playing
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={onPlaySingle}
              className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-muted)]/20 px-4 py-3 text-left active:opacity-80"
            >
              <Play className="h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  Play this ayah only
                </div>
                <div className="text-xs text-[var(--color-muted)]">
                  Stop the current range and play just this verse
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onContinueFromHere}
              className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-muted)]/20 px-4 py-3 text-left active:opacity-80"
            >
              <FastForward className="h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  Continue from here
                </div>
                <div className="text-xs text-[var(--color-muted)]">
                  Skip to this verse and continue the range
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-4 py-3 text-sm text-[var(--color-muted)] active:opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
