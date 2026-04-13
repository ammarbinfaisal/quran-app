"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { usePreferences } from "@/hooks/usePreferences";
import { getAudioElement, pauseAudio, playAudio } from "@/lib/audio";
import {
  getAyahRecitation,
  DEFAULT_AYAH_RECITER,
  type AyahRecitationEntry,
} from "@/lib/ayahRecitation";
import type { AyahReciterId } from "@/lib/types";

export type RecitationStatus = "idle" | "loading" | "playing" | "paused";

export interface RecitationRange {
  mode: "custom";
  startVerse: string;
  endVerse: string;
  verses: string[]; // List of verse keys in order
}

interface RecitationContextValue {
  // State
  status: RecitationStatus;
  range: RecitationRange | null;
  currentVerse: string | null;
  currentWordIndex: number | null;
  repeat: boolean;
  syncWithRecitation: boolean;
  progress: number;
  reciterId: AyahReciterId;

  // Setters
  setRepeat: (repeat: boolean) => void;
  setSyncWithRecitation: (sync: boolean) => void;
  setReciterId: (id: AyahReciterId) => void;

  // Actions
  togglePlayPause: () => void;
  playVerse: (verseKey: string) => Promise<void>;
  playRange: (range: RecitationRange) => Promise<void>;
  jumpToVerseInRange: (verseKey: string) => boolean;
  skipForward: () => void;
  skipBackward: () => void;
  stop: () => void;

  // Labels
  currentVerseLabel: string | null;
  rangeLabel: string | null;
}

const RecitationContext = createContext<RecitationContextValue | null>(null);

// Dispatch event when current verse changes (for sync highlighting)
function dispatchVerseChange(verseKey: string | null, wordIndex: number | null) {
  window.dispatchEvent(
    new CustomEvent("recitation-verse-change", {
      detail: { verseKey, wordIndex },
    })
  );
}

export function RecitationProvider({ children }: { children: ReactNode }) {
  const { prefs, setPref } = usePreferences();
  const [status, setStatus] = useState<RecitationStatus>("idle");
  const [range, setRange] = useState<RecitationRange | null>(null);
  const [currentVerse, setCurrentVerse] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [syncWithRecitation, setSyncWithRecitation] = useState(true);
  const [progress, setProgress] = useState(0);

  const reciterId = prefs.ayahReciterId;
  const setReciterId = useCallback(
    (id: AyahReciterId) => setPref("ayahReciterId", id),
    [setPref]
  );

  const rafRef = useRef<number>(0);
  const currentRecitationRef = useRef<AyahRecitationEntry | null>(null);
  const verseIndexRef = useRef<number>(0);

  // Update word index based on current time and segments
  const updateWordIndex = useCallback(() => {
    const el = getAudioElement();
    const recitation = currentRecitationRef.current;
    if (!el || !recitation || !recitation.segments.length) return;

    const currentMs = el.currentTime * 1000;
    let foundIndex: number | null = null;

    for (const [wordIdx, startMs, endMs] of recitation.segments) {
      if (currentMs >= startMs && currentMs <= endMs) {
        foundIndex = wordIdx;
        break;
      }
    }

    if (foundIndex !== currentWordIndex) {
      setCurrentWordIndex(foundIndex);
      if (syncWithRecitation) {
        dispatchVerseChange(currentVerse, foundIndex);
      }
    }
  }, [currentVerse, currentWordIndex, syncWithRecitation]);

  // Update progress and word index during playback
  const updateProgress = useCallback(() => {
    const el = getAudioElement();
    if (el && el.duration && Number.isFinite(el.duration)) {
      setProgress(el.currentTime / el.duration);
      updateWordIndex();
    }
    rafRef.current = requestAnimationFrame(updateProgress);
  }, [updateWordIndex]);

  // Play a specific verse
  const playVerseInternal = useCallback(
    async (verseKey: string) => {
      setStatus("loading");
      setCurrentVerse(verseKey);
      setCurrentWordIndex(null);

      try {
        const recitation = await getAyahRecitation(reciterId, verseKey);
        if (!recitation) {
          setStatus("idle");
          return false;
        }

        currentRecitationRef.current = recitation;
        playAudio(recitation.audio_url);

        setStatus("playing");
        rafRef.current = requestAnimationFrame(updateProgress);

        if (syncWithRecitation) {
          dispatchVerseChange(verseKey, null);
        }

        return true;
      } catch {
        setStatus("idle");
        return false;
      }
    },
    [reciterId, syncWithRecitation, updateProgress]
  );

  // Handle verse end - advance to next verse or repeat
  const handleVerseEnded = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    if (!range || !range.verses.length) {
      setStatus("idle");
      setProgress(0);
      setCurrentVerse(null);
      setCurrentWordIndex(null);
      dispatchVerseChange(null, null);
      return;
    }

    const currentIndex = verseIndexRef.current;
    const nextIndex = currentIndex + 1;

    if (nextIndex < range.verses.length) {
      // Play next verse in range
      verseIndexRef.current = nextIndex;
      playVerseInternal(range.verses[nextIndex]);
    } else if (repeat) {
      // Restart from beginning
      verseIndexRef.current = 0;
      playVerseInternal(range.verses[0]);
    } else {
      // Range complete
      setStatus("idle");
      setProgress(0);
      setCurrentVerse(null);
      setCurrentWordIndex(null);
      verseIndexRef.current = 0;
      dispatchVerseChange(null, null);
    }
  }, [range, repeat, playVerseInternal]);

  // Keep the latest handlers in refs so the audio element listeners (mounted once)
  // always see the current state without re-binding.
  const handleVerseEndedRef = useRef(handleVerseEnded);
  handleVerseEndedRef.current = handleVerseEnded;

  useMountEffect(() => {
    const el = getAudioElement();

    const onEnded = () => handleVerseEndedRef.current();
    const onError = () => {
      setStatus("idle");
      cancelAnimationFrame(rafRef.current);
    };

    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      cancelAnimationFrame(rafRef.current);
    };
  });

  const togglePlayPause = useCallback(() => {
    if (status === "playing") {
      pauseAudio();
      setStatus("paused");
      cancelAnimationFrame(rafRef.current);
    } else if (status === "paused") {
      const el = getAudioElement();
      if (el.src) {
        void el.play();
        setStatus("playing");
        rafRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [status, updateProgress]);

  const playVerse = useCallback(
    async (verseKey: string) => {
      // Single verse mode - no range
      setRange(null);
      verseIndexRef.current = 0;
      await playVerseInternal(verseKey);
    },
    [playVerseInternal]
  );

  const playRange = useCallback(
    async (newRange: RecitationRange) => {
      if (!newRange.verses.length) return;

      setRange(newRange);
      verseIndexRef.current = 0;
      await playVerseInternal(newRange.verses[0]);
    },
    [playVerseInternal]
  );

  const jumpToVerseInRange = useCallback(
    (verseKey: string): boolean => {
      if (!range || !range.verses.length) return false;
      const idx = range.verses.indexOf(verseKey);
      if (idx < 0) return false;
      verseIndexRef.current = idx;
      void playVerseInternal(verseKey);
      return true;
    },
    [range, playVerseInternal]
  );

  const skipForward = useCallback(() => {
    if (!range || !range.verses.length) return;

    const currentIndex = verseIndexRef.current;
    const nextIndex = currentIndex + 1;

    if (nextIndex < range.verses.length) {
      verseIndexRef.current = nextIndex;
      playVerseInternal(range.verses[nextIndex]);
    } else if (repeat) {
      verseIndexRef.current = 0;
      playVerseInternal(range.verses[0]);
    }
  }, [range, repeat, playVerseInternal]);

  const skipBackward = useCallback(() => {
    if (!range || !range.verses.length) return;

    const currentIndex = verseIndexRef.current;
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      verseIndexRef.current = prevIndex;
      playVerseInternal(range.verses[prevIndex]);
    } else if (repeat) {
      verseIndexRef.current = range.verses.length - 1;
      playVerseInternal(range.verses[range.verses.length - 1]);
    }
  }, [range, repeat, playVerseInternal]);

  const stop = useCallback(() => {
    pauseAudio();
    cancelAnimationFrame(rafRef.current);
    setStatus("idle");
    setProgress(0);
    setCurrentVerse(null);
    setCurrentWordIndex(null);
    setRange(null);
    verseIndexRef.current = 0;
    currentRecitationRef.current = null;
    dispatchVerseChange(null, null);
  }, []);

  const currentVerseLabel = currentVerse ? `Ayah ${currentVerse}` : null;

  const rangeLabel = range
    ? range.verses.length === 1
      ? `Ayah ${range.startVerse}`
      : `${range.startVerse} - ${range.endVerse}`
    : null;

  const value: RecitationContextValue = {
    status,
    range,
    currentVerse,
    currentWordIndex,
    repeat,
    syncWithRecitation,
    progress,
    reciterId,
    setRepeat,
    setSyncWithRecitation,
    setReciterId,
    togglePlayPause,
    playVerse,
    playRange,
    jumpToVerseInRange,
    skipForward,
    skipBackward,
    stop,
    currentVerseLabel,
    rangeLabel,
  };

  return (
    <RecitationContext.Provider value={value}>
      {children}
    </RecitationContext.Provider>
  );
}

export function useRecitationPlayer(): RecitationContextValue {
  const context = useContext(RecitationContext);
  if (!context) {
    // Return a default value when not in provider
    return {
      status: "idle",
      range: null,
      currentVerse: null,
      currentWordIndex: null,
      repeat: false,
      syncWithRecitation: true,
      progress: 0,
      reciterId: DEFAULT_AYAH_RECITER,
      setRepeat: () => {},
      setSyncWithRecitation: () => {},
      setReciterId: () => {},
      togglePlayPause: () => {},
      playVerse: async () => {},
      playRange: async () => {},
      jumpToVerseInRange: () => false,
      skipForward: () => {},
      skipBackward: () => {},
      stop: () => {},
      currentVerseLabel: null,
      rangeLabel: null,
    };
  }
  return context;
}

/**
 * Hook to listen for verse changes during recitation playback.
 * Used by components that want to highlight the current verse/word.
 */
export function useRecitationSync(
  onVerseChange: (verseKey: string | null, wordIndex: number | null) => void
) {
  useMountEffect(() => {
    const handler = (e: CustomEvent<{ verseKey: string | null; wordIndex: number | null }>) => {
      onVerseChange(e.detail.verseKey, e.detail.wordIndex);
    };

    window.addEventListener("recitation-verse-change", handler as EventListener);
    return () => {
      window.removeEventListener("recitation-verse-change", handler as EventListener);
    };
  });
}
