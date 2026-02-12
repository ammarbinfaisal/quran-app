"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
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
  const [dimensions, setDimensions] = useState({ width: 390, height: 552, maxH: 552 });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isNavigatingRef = useRef(false);
  const navDirectionRef = useRef<"next" | "prev" | null>(null);

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
      const maxH = Math.max(360, window.innerHeight - 56);

      const maxW = settings.mushafNavigation === "scroll" ? 980 : 760;
      const availableW = Math.max(280, Math.min(window.innerWidth - 16, maxW));

      let w = availableW;
      let h = Math.round(w * PAGE_RATIO);

      // In swipe mode, keep the full page visible (no internal scroll).
      if (settings.mushafNavigation === "swipe" && h > maxH) {
        h = maxH;
        w = Math.round(h / PAGE_RATIO);
      }

      setDimensions({ width: w, height: h, maxH });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [settings.mushafNavigation]);

  useEffect(() => {
    // When switching modes, reset scroll position/state.
    isNavigatingRef.current = false;
    navDirectionRef.current = null;
    const el = scrollRef.current;
    if (el && settings.mushafNavigation === "scroll") {
      el.scrollTop = 0;
    }
  }, [settings.mushafNavigation]);

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

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage((current) => (withinRange(nextPage) ? nextPage : current));
    },
    [withinRange]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isNavigatingRef.current) return;

    const threshold = 28;
    const atTop = el.scrollTop <= threshold;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    if (atBottom && withinRange(page + 1)) {
      isNavigatingRef.current = true;
      navDirectionRef.current = "next";
      shiftPage(1);
      return;
    }

    if (atTop && withinRange(page - 1)) {
      isNavigatingRef.current = true;
      navDirectionRef.current = "prev";
      shiftPage(-1);
    }
  }, [page, shiftPage, withinRange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const dir = navDirectionRef.current;
    navDirectionRef.current = null;

    // After page change, position scroll so navigation feels continuous.
    requestAnimationFrame(() => {
      if (dir === "next") {
        el.scrollTop = 0;
      } else if (dir === "prev") {
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      }

      isNavigatingRef.current = false;
    });
  }, [page]);

  const canRenderMushaf =
    hydrated &&
    settings.mushafCode === routeMushafCode &&
    settings.translationCode === routeTranslationCode;

  const viewerTheme = settings.theme === "dark" ? "dark" : "light";

  return (
    <>
      <div
        className="flex justify-center oqv-container"
        onMouseOver={(e) => {
          const el = e.target as HTMLElement;
          if (el.getAttribute("role") === "button") {
            el.style.background = "transparent";
          }
        }}
      >
        {settings.mushafNavigation === "scroll" ? (
          <div
            ref={scrollRef}
            className="w-full overflow-y-auto scrollbar-none"
            style={{ maxHeight: dimensions.maxH }}
            onScroll={handleScroll}
          >
            <div className="flex justify-center py-2">
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
          </div>
        ) : (
          <div className="flex justify-center py-2">
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
                onPageChange={handlePageChange}
              />
            ) : (
              <MushafSkeleton />
            )}
          </div>
        )}
      </div>

      <TranslationSheet
        verseKey={selectedVerse}
        onClose={() => setSelectedVerse(null)}
      />
    </>
  );
}
