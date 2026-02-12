"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type WheelEvent,
  type TouchEvent,
} from "react";
import dynamic from "next/dynamic";
import { TranslationSheet } from "./TranslationSheet";
import { useSettings } from "@/context/SettingsContext";
import { preloadNeighborPages } from "@/lib/mushaf/loader";
import { type MushafCode, type TranslationCode } from "@/lib/preferences";

const OpenQuranView = dynamic(
  () => import("open-quran-view/view/react").then((m) => m.OpenQuranView),
  { ssr: false, loading: () => <MushafSkeleton /> }
);

function MushafSkeleton() {
  return (
    <div className="flex items-center justify-center w-full min-h-[60dvh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
        <span className="text-sm">Loading mushaf...</span>
      </div>
    </div>
  );
}

interface MushafViewerProps {
  startPage: number;
  endPage?: number;
  initialAyah?: string;
  routeMushafCode: MushafCode;
  routeTranslationCode: TranslationCode;
}

export function MushafViewer({
  startPage,
  endPage,
  initialAyah,
  routeMushafCode,
  routeTranslationCode,
}: MushafViewerProps) {
  const { settings, hydrated, updateSettings } = useSettings();
  const [page, setPage] = useState(startPage);
  const [selectedVerse, setSelectedVerse] = useState<string | null>(
    initialAyah ?? null
  );
  const [dimensions, setDimensions] = useState({ width: 390, height: 552 });
  const lastWheelNavAt = useRef(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setPage(startPage);
  }, [startPage]);

  useEffect(() => {
    if (
      settings.mushafCode !== routeMushafCode ||
      settings.translationCode !== routeTranslationCode
    ) {
      updateSettings({
        mushafCode: routeMushafCode,
        translationCode: routeTranslationCode,
      });
    }
  }, [
    routeMushafCode,
    routeTranslationCode,
    settings.mushafCode,
    settings.translationCode,
    updateSettings,
  ]);

  useEffect(() => {
    function measure() {
      // Keep the viewer aspect ratio stable to avoid non-uniform scaling.
      // open-quran-view defaults to 600x850.
      const PAGE_RATIO = 850 / 600;
      const availableW = Math.max(280, Math.min(window.innerWidth - 24, 760));
      const availableH = Math.max(360, window.innerHeight - 56);

      let w = availableW;
      let h = Math.round(w * PAGE_RATIO);
      if (h > availableH) {
        h = availableH;
        w = Math.round(h / PAGE_RATIO);
      }

      setDimensions({ width: w, height: h });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    // Warm current/adjacent page payloads in background.
    void preloadNeighborPages(routeMushafCode, page);
  }, [routeMushafCode, page]);

  const handleWordClick = useCallback(
    (word: { id: number; surahNumber?: number; ayahNumber?: number }) => {
      if (word.surahNumber && word.ayahNumber) {
        setSelectedVerse(`${word.surahNumber}:${word.ayahNumber}`);
      }
    },
    []
  );

  const withinRange = useCallback(
    (p: number) => !endPage || (p >= startPage && p <= endPage),
    [startPage, endPage]
  );

  const shiftPage = useCallback(
    (delta: number) => {
      setPage((current) => {
        const next = current + delta;
        return withinRange(next) ? next : current;
      });
    },
    [withinRange]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Use vertical scroll to navigate pages (disable left/right paging).
      const now = Date.now();
      if (now - lastWheelNavAt.current < 220) return;
      if (Math.abs(e.deltaY) < 16) return;

      const dir = e.deltaY > 0 ? 1 : -1;
      lastWheelNavAt.current = now;
      e.preventDefault();
      shiftPage(dir);
    },
    [shiftPage]
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const startY = touchStartY.current;
      touchStartY.current = null;
      if (startY == null) return;

      const endY = e.changedTouches[0]?.clientY;
      if (typeof endY !== "number") return;

      const delta = startY - endY;
      if (Math.abs(delta) < 48) return;
      const dir = delta > 0 ? 1 : -1;
      shiftPage(dir);
    },
    [shiftPage]
  );

  const canRenderMushaf =
    hydrated &&
    settings.mushafCode === routeMushafCode &&
    settings.translationCode === routeTranslationCode;

  const viewerTheme = settings.theme === "dark" ? "dark" : "light";

  return (
    <>
      <div
        className="flex justify-center oqv-container"
        style={{ touchAction: "pan-y" }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseOver={(e) => {
          const el = e.target as HTMLElement;
          if (el.getAttribute("role") === "button") {
            el.style.background = "transparent";
          }
        }}
      >
        {canRenderMushaf ? (
          <OpenQuranView
            key={`${settings.mushafLayout}:${viewerTheme}`}
            page={page}
            width={dimensions.width}
            height={dimensions.height}
            mushafLayout={settings.mushafLayout}
            theme={viewerTheme}
            className="oqv-view"
            onWordClick={handleWordClick}
            onPageChange={() => {
              // Intentionally ignore built-in paging (we use scroll).
            }}
          />
        ) : (
          <MushafSkeleton />
        )}
      </div>

      <TranslationSheet
        verseKey={selectedVerse}
        onClose={() => setSelectedVerse(null)}
      />
    </>
  );
}
