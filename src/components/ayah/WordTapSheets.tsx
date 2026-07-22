"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Bookmark, BookmarkPlus, BookMarked, BookOpen, Copy, FileText, GitBranch, Play, Search, CornerDownRight } from "lucide-react";
import { AyahSheet } from "@/components/ayah/AyahSheet";
import { BookmarkSheet } from "@/components/ayah/BookmarkSheet";
import { FloatingWordMenu } from "@/components/ayah/FloatingWordMenu";
import { IraabSheet } from "@/components/ayah/IraabSheet";
import { MutashabihatSheet } from "@/components/ayah/MutashabihatSheet";
import { NotesSheet } from "@/components/ayah/NotesSheet";
import { MorphologySheet } from "@/components/mushaf/MorphologySheet";
import { loadMutashabihatVerseMap } from "@/lib/mutashabihat";
import { loadAbuIyaadNotes } from "@/lib/translations/abu-iyaad";
import type { MushafCode, TranslationId, UserPreferences } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { useBookmarks } from "@/hooks/useBookmarks";
import { buildVerseCopyText, type VerseCopyMode, type VerseCopySettings } from "@/lib/verseCopy";
import { isMorphologyTap, type WordTapTarget } from "@/lib/wordTap";
import { useRecitationPlayer } from "@/components/recitation/useRecitationPlayer";
import { showToast } from "@/lib/toast";
import {
  getIraabAvailabilitySync,
  isIraabAvailable,
  loadIraabAvailability,
  loadTafsirAvailability,
  type IraabAvailability,
} from "@/lib/tafsir/loader";
import {
  pickPreferredAvailableTafsirId,
  scheduleWordTapTafsirPrefetch,
} from "@/lib/tafsir/prefetch";
import { tafsirPath } from "@/lib/url";

type ActiveSheet = "translation" | "morphology" | "iraab" | "notes" | "mutashabihat" | "bookmarks" | null;

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
  const [iraabAvailability, setIraabAvailability] = useState<IraabAvailability | null>(
    getIraabAvailabilitySync(),
  );
  const { prefs } = usePreferences();
  const { isBookmarked } = useBookmarks();
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
        const [surahPart, ayahPart] = tap.verseKey.split(":");
        const surah = Number.parseInt(surahPart, 10);
        const ayah = Number.parseInt(ayahPart, 10);
        if (Number.isFinite(surah) && Number.isFinite(ayah)) {
          scheduleWordTapTafsirPrefetch(
            surah,
            ayah,
            prefs.dataUsageMode,
            prefs.tafsirOrder,
          );
          // Load i3raab availability without blocking the menu. Default unknown
          // allows the action to show; the sheet handles unavailable states.
          loadIraabAvailability()
            .then((manifest) => setIraabAvailability(manifest))
            .catch(() => {});
        }
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
    const verseIsBookmarked = isBookmarked(selectedTap.verseKey);

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
      {
        id: "bookmarks",
        icon: verseIsBookmarked ? (
          <Bookmark className="h-4 w-4" />
        ) : (
          <BookmarkPlus className="h-4 w-4" />
        ),
        label: "Manage bookmarks",
        onClick: () => setActiveSheet("bookmarks"),
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
      const surah = Number.parseInt(s, 10);
      const ayah = Number.parseInt(a, 10);
      // Show i3raab action when available or unknown; hide only when the
      // manifest confirms this ayah is known unavailable.
      if (
        Number.isFinite(surah) &&
        Number.isFinite(ayah) &&
        isIraabAvailable(iraabAvailability, surah, ayah) !== false
      ) {
        items.push({
          id: "iraab",
          icon: <GitBranch className="h-4 w-4" />,
          label: "Open iʿraab",
          onClick: () => setActiveSheet("iraab"),
        });
      }
    }

    {
      const [s, a] = selectedTap.verseKey.split(":");
      items.push({
        id: "tafsir",
        icon: <BookMarked className="h-4 w-4" />,
        label: "Open tafsir",
        onClick: () => {
          const surah = Number.parseInt(s, 10);
          const ayah = Number.parseInt(a, 10);
          if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;
          onClose();
          void (async () => {
            await loadTafsirAvailability().catch(() => null);
            const tafsirId = pickPreferredAvailableTafsirId(
              surah,
              ayah,
              prefs.tafsirOrder,
            );
            router.push(tafsirPath(tafsirId, surah, ayah));
          })();
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
    iraabAvailability,
    isRangePlaying,
    isBookmarked,
    onClose,
    prefs.tafsirOrder,
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

      <BookmarkSheet
        open={activeSheet === "bookmarks"}
        verseKey={selectedTap.verseKey}
        onClose={onClose}
      />

      <MorphologySheet
        open={activeSheet === "morphology"}
        verseKey={selectedTap.verseKey}
        wordIndex={selectedTap.wordIndex}
        mushafCode={mushafCode}
        onClose={onClose}
      />

      <IraabSheet
        open={activeSheet === "iraab"}
        verseKey={selectedTap.verseKey}
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
