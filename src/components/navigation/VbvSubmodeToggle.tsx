"use client";

import { useState } from "react";
import { BookMarked, Library, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/hooks/usePreferences";
import { useChapters } from "@/hooks/useChapters";
import { pageToSurah, pageToJuz, fetchVersePages } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import type { VbvSubmode } from "@/lib/types";
import { getFirstFullyVisibleVerse } from "@/lib/viewport";

const OPTIONS: { value: VbvSubmode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "s", label: "Surah", Icon: BookMarked },
    { value: "j", label: "Juz", Icon: Library },
    { value: "p", label: "Page", Icon: FileText },
];

interface VbvSubmodeToggleProps {
    currentType: VbvSubmode;
    currentId: number;
    onNavigate: (type: VbvSubmode, id: number, verse?: string | null) => void;
}

export function VbvSubmodeToggle({ currentType, currentId, onNavigate }: VbvSubmodeToggleProps) {
    const { setPref } = usePreferences();
    const chapters = useChapters();
    const [pending, setPending] = useState<VbvSubmode | null>(null);

    async function handleSelect(newSubmode: VbvSubmode) {
        if (newSubmode === currentType || pending !== null) return;

        setPending(newSubmode);
        setPref("vbvSubmode", newSubmode);

        // Try to get the first visible verse to preserve position
        const scrollContainer = document.querySelector("[data-vbv-scroll]");
        const currentVerse = scrollContainer ? getFirstFullyVisibleVerse(scrollContainer as HTMLElement) : null;

        let currentPage = 1;
        let currentSurah = currentId; // fallback

        // Derive accurate position from current verse if possible
        if (currentVerse) {
            const versePages = await fetchVersePages("v2"); // Always v2 for now
            const lookup = versePages[currentVerse];
            if (lookup) {
                currentPage = typeof lookup === "number" ? lookup : lookup[0];
            }
            currentSurah = parseInt(currentVerse.split(":")[0], 10);
        } else {
            // Fallback: derive from currentId (start of section)
            if (currentType === "p") {
                currentPage = currentId;
            } else if (currentType === "s") {
                const ch = chapters.find((c) => c.id === currentId);
                currentPage = ch ? ch.pages[0] : 1;
            } else if (currentType === "j") {
                const j = JUZ_PAGE_RANGES.find((jr) => jr.juz === currentId);
                currentPage = j ? j.pages[0] : 1;
            }
            if (currentType === "s") currentSurah = currentId;
            else currentSurah = pageToSurah(currentPage, chapters);
        }

        // Map anchor position to the target submode's id
        let targetId: number;
        if (newSubmode === "p") {
            targetId = currentPage;
        } else if (newSubmode === "s") {
            targetId = currentSurah;
        } else {
            targetId = pageToJuz(currentPage);
        }

        onNavigate(newSubmode, targetId, currentVerse);
        setPending(null);
    }

    const visualActive = pending ?? currentType;
    const activeIndex = OPTIONS.findIndex((o) => o.value === visualActive);

    return (
        <div
            className="relative flex h-8 items-center rounded-full bg-[var(--color-surface)] p-[2px] shadow-inner"
            style={{ width: "90px" }}
            aria-label="VbV submode"
        >
            {/* Sliding pill — 28px wide, translates by 28px steps */}
            <div
                className="absolute top-[2px] bottom-[2px] w-[28px] rounded-full bg-[var(--color-bg)] shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]"
                style={{ transform: `translateX(${activeIndex * 28}px)` }}
            />
            {OPTIONS.map(({ value, label, Icon }, i) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => handleSelect(value)}
                    disabled={pending !== null}
                    className={cn(
                        "relative z-10 flex w-[28px] items-center justify-center transition-colors duration-300",
                        activeIndex === i ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
                    )}
                    aria-label={`VbV submode: ${label}`}
                    aria-pressed={activeIndex === i}
                >
                    {pending === value ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Icon className="h-3.5 w-3.5" />
                    )}
                </button>
            ))}
        </div>
    );
}
