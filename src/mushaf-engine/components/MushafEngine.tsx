"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import type { MushafCode, TranslationCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";
import { TranslationSheet } from "@/components/TranslationSheet";
import { MushafScrollView } from "@/mushaf-engine/components/MushafScrollView";
import { MushafSwipeView } from "@/mushaf-engine/components/MushafSwipeView";
import { useMushafRuntime } from "@/mushaf-engine/runtime/useMushafRuntime";

export function MushafEngine(props: {
  startPage: number;
  endPage?: number;
  initialAyah?: string;
  routeMushafCode: MushafCode;
  routeTranslationCode: TranslationCode;
  initialData?: MushafPagePayload | null;
  initialFontStyles?: string;
}) {
  const { 
    startPage, 
    endPage, 
    initialAyah, 
    routeMushafCode, 
    routeTranslationCode,
    initialData,
    initialFontStyles
  } = props;

  const { settings, hydrated, updateSettings } = useSettings();
  const runtime = useMushafRuntime(routeMushafCode, initialData);

  const [selectedVerse, setSelectedVerse] = useState<string | null>(initialAyah ?? null);
  const onVerseSelect = useCallback((verseKey: string) => {
    setSelectedVerse(verseKey);
  }, []);

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

  const effectiveEndPage = endPage ?? startPage;

  const canRender =
    hydrated &&
    settings.mushafCode === routeMushafCode &&
    settings.translationCode === routeTranslationCode;

  const showDebug = useMemo(() => {
    if (process.env.NODE_ENV !== "development") return false;
    return false;
  }, []);

  return (
    <>
      {initialFontStyles && (
        <style dangerouslySetInnerHTML={{ __html: initialFontStyles }} />
      )}
      <div className="flex-1 min-h-0 flex justify-center">
        <div className="w-full max-w-6xl flex-1 min-h-0">
          {canRender ? (
            settings.mushafNavigation === "scroll" ? (
              <MushafScrollView
                mushafCode={routeMushafCode}
                startPage={startPage}
                endPage={effectiveEndPage}
                runtime={runtime}
                onVerseSelect={onVerseSelect}
                showDebug={showDebug}
                lowDataMode={settings.lowDataMode}
              />
            ) : (
              <MushafSwipeView
                mushafCode={routeMushafCode}
                startPage={startPage}
                endPage={effectiveEndPage}
                runtime={runtime}
                onVerseSelect={onVerseSelect}
                showDebug={showDebug}
                lowDataMode={settings.lowDataMode}
              />
            )
          ) : (
            <div className="flex items-center justify-center w-full min-h-[60dvh]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
                <span className="text-sm">Loading mushaf…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <TranslationSheet verseKey={selectedVerse} onClose={() => setSelectedVerse(null)} />
    </>
  );
}

