"use client";

import { useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { RecitationPlayerSheet } from "@/components/recitation/RecitationPlayerSheet";
import { useRecitationPlayer } from "@/components/recitation/useRecitationPlayer";
import { useRecitationContext } from "@/components/recitation/RecitationContext";

export function RecitationButton() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { status, rangeProgress } = useRecitationPlayer();
  const { currentPage, currentSurahId, currentJuzId } = useRecitationContext();

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const hasActivePlayback = status !== "idle";

  // Mini progress ring (shown when playing/paused with active range)
  const progressDeg = rangeProgress * 360;

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="relative flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
        aria-label={hasActivePlayback ? "Open recitation player" : "Play recitation"}
      >
        {/* Progress ring background */}
        {hasActivePlayback && (
          <span
            className="absolute inset-1.5 rounded-full"
            style={{
              background: `conic-gradient(var(--color-accent) ${progressDeg}deg, transparent ${progressDeg}deg)`,
              opacity: 0.3,
            }}
          />
        )}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5 text-[var(--color-accent)]" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>

      <RecitationPlayerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentPage={currentPage}
        currentSurahId={currentSurahId}
        currentJuzId={currentJuzId}
      />
    </>
  );
}
