"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import {
  loadChapterAudio,
  playAudio,
  pauseAudio,
  isPlaying,
  getAudioElement,
} from "@/lib/audio";

interface AudioPlayerProps {
  chapterId: number;
  chapterName: string;
}

export default function AudioPlayer({ chapterId, chapterName }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Reset when chapter changes
    setAudioUrl(null);
    setPlaying(false);
    setProgress(0);
  }, [chapterId]);

  const updateProgress = useCallback(() => {
    const el = getAudioElement();
    if (el && el.duration) {
      setProgress(el.currentTime / el.duration);
    }
    if (isPlaying()) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const handleToggle = useCallback(async () => {
    if (playing) {
      pauseAudio();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let url = audioUrl;
    if (!url) {
      setLoading(true);
      try {
        const af = await loadChapterAudio(chapterId);
        url = af.url;
        setAudioUrl(url);
      } catch {
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    playAudio(url);
    setPlaying(true);
    rafRef.current = requestAnimationFrame(updateProgress);

    const el = getAudioElement();
    if (el) {
      el.onended = () => {
        setPlaying(false);
        setProgress(0);
        cancelAnimationFrame(rafRef.current);
      };
    }
  }, [playing, audioUrl, chapterId, updateProgress]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex items-center gap-3 py-2">
      <button
        onClick={handleToggle}
        disabled={loading}
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-accent)", color: "var(--color-bg)" }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Al-Husary &middot; {chapterName}
        </div>
        <div
          className="mt-1 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--color-muted)", opacity: 0.3 }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: "var(--color-accent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
