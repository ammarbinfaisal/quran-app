"use client";

import React, { useMemo } from "react";
import { useAbuIyaadSurahs } from "@/hooks/useAbuIyaadSurahs";
import { cn } from "@/lib/utils";
import { Bismillah } from "./Bismillah";

/**
 * Surah header displayed at the top of pages where a new surah begins.
 * Renders a decorative surah title band and optionally a bismillah line.
 */
export function SurahHeader({
    nameSimple,
    surahNumber,
    showBismillah,
    variant = "mushaf",
    className,
}: {
    nameSimple: string;
    surahNumber: number;
    showBismillah: boolean;
    variant?: "mushaf" | "viewer";
    className?: string;
}) {
    const surahs = useAbuIyaadSurahs();
    const translatedName = useMemo(
        () => surahs?.[surahNumber.toString()],
        [surahs, surahNumber]
    );

    const shouldShowBismillah =
        showBismillah && surahNumber !== 1 && surahNumber !== 9;

    return (
        <>
            <div
                className={cn(
                    "rounded-2xl border bg-[var(--color-surface)] shadow-sm",
                    "border-[var(--color-muted)]/15",
                    variant === "mushaf"
                        ? "px-2 py-0.5 max-h-full"
                        : "px-4 py-3",
                    className
                )}
            >
                <div
                    className={cn(
                        "flex items-center justify-center",
                        variant === "mushaf"
                            ? "flex-col gap-0.5"
                            : "flex-row gap-3"
                    )}
                >
                    <span
                        translate="no"
                        className={cn(
                            "select-none leading-none text-[var(--color-text)] font-normal",
                            variant === "mushaf" ? "text-[1.55rem]" : "text-[2.25rem]"
                        )}
                        style={{ fontFamily: "surahnames" }}
                        aria-label={`Surah ${surahNumber}`}
                    >
                        {String(surahNumber).padStart(3, "0")}
                    </span>

                    <div
                        className={cn(
                            "leading-tight",
                            variant === "mushaf" ? "text-center" : "text-center sm:text-left"
                        )}
                    >
                        <div
                            className={cn(
                                "font-semibold text-[var(--color-text)]",
                                variant === "mushaf" ? "text-[0.55rem]" : "text-lg"
                            )}
                        >
                            {surahNumber}. {nameSimple}
                            {variant === "mushaf" && translatedName && (
                                <span className="ml-1 opacity-70 font-normal text-[0.9em]">
                                    ({translatedName})
                                </span>
                            )}
                        </div>

                        {variant === "viewer" && translatedName && (
                            <div className="text-sm text-[var(--color-muted)] opacity-80">
                                {translatedName}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {shouldShowBismillah && (
                <div
                    className={cn(
                        "flex items-center justify-center",
                        variant === "mushaf" ? "mt-1" : "mt-4"
                    )}
                    dir="rtl"
                >
                    <Bismillah
                        className={cn(
                            "w-auto max-w-[70vw] text-[var(--color-text)] opacity-90 mx-auto",
                            variant === "mushaf" ? "h-5" : "h-9 sm:h-10"
                        )}
                    />
                </div>
            )}
        </>
    );
}
