"use client";

import React from "react";
import { useAbuIyaadSurahs } from "@/hooks/useAbuIyaadSurahs";
import { Bismillah } from "./Bismillah";

/**
 * Surah header displayed at the top of pages where a new surah begins.
 * Renders a decorative surah title band and optionally a bismillah line.
 */
export function SurahHeader({
    nameSimple,
    surahNumber,
    showBismillah,
}: {
    nameSimple: string;
    surahNumber: number;
    showBismillah: boolean;
}) {
    const surahs = useAbuIyaadSurahs();
    const translatedName = surahs?.[surahNumber.toString()];

    return (
        <>
            {/* Surah title band */}
            <div className="surah-header">
                <span className="surah-header-icon" translate="no" style={{ fontFamily: 'surahnames' }}>
                    {String(surahNumber).padStart(3, "0")}
                </span>
                <span className="surah-header-name">
                    {surahNumber}. {nameSimple} {translatedName && <span className="opacity-80 text-[0.8em] font-normal" style={{ marginLeft: "0.25rem" }}>({translatedName})</span>}
                </span>
            </div>

            {/* Bismillah line (all surahs except At-Tawbah and Al-Fatiha header only) */}
            {showBismillah && surahNumber !== 9 && (
                <div className="bismillah-line" dir="rtl">
                    <Bismillah className="h-full w-auto max-w-[70vw] text-[var(--color-text)] opacity-90 mx-auto" />
                </div>
            )}
        </>
    );
}
