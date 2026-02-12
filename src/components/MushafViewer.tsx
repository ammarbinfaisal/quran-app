"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [dimensions, setDimensions] = useState({ width: 390, height: 700 });

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
      const w = Math.min(window.innerWidth, 600);
      const h = window.innerHeight - 56;
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

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!endPage || (newPage >= startPage && newPage <= endPage)) {
        setPage(newPage);
      }
    },
    [startPage, endPage]
  );

  const canRenderMushaf =
    hydrated &&
    settings.mushafCode === routeMushafCode &&
    settings.translationCode === routeTranslationCode;

  return (
    <>
      <div
        className="flex justify-center"
        onMouseOver={(e) => {
          const el = e.target as HTMLElement;
          if (el.getAttribute("role") === "button") {
            el.style.background = "transparent";
          }
        }}
      >
        {canRenderMushaf ? (
          <OpenQuranView
            page={page}
            width={dimensions.width}
            height={dimensions.height}
            mushafLayout={settings.mushafLayout}
            theme="light"
            onWordClick={handleWordClick}
            onPageChange={handlePageChange}
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
