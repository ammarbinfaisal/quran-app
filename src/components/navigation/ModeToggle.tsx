"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChapters } from "@/hooks/useChapters";
import { usePreferences } from "@/hooks/usePreferences";
import { pageToSurah, pageToJuz } from "@/lib/navigation/maps";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { parseVbvPath, vbvPath } from "@/lib/url";
import { getFirstFullyVisibleVerse } from "@/lib/viewport";
import { fetchVersePages, pageToFirstVerse } from "@/lib/navigation/maps";


export function ModeToggle() {
    const pathname = usePathname();
    const router = useRouter();
    const chapters = useChapters();
    const { prefs } = usePreferences();

    const isVerseMode = pathname.startsWith("/v/");

    const handleToggle = async () => {
        if (isVerseMode) {
            // Verse Mode -> Mushaf Mode
            const scrollContainer = document.querySelector("[data-vbv-scroll]");
            let targetVerse: string | null = null;
            let targetPage: number | null = null;

            if (scrollContainer) {
                targetVerse = getFirstFullyVisibleVerse(scrollContainer as HTMLElement);
                if (targetVerse) {
                    const versePages = await fetchVersePages(prefs.mushafCode);
                    const lookup = versePages[targetVerse];
                    if (lookup) {
                        targetPage = typeof lookup === "number" ? lookup : lookup[0];
                    }
                }
            }

            if (targetPage) {
                router.push(`/p/${targetPage}?verse=${targetVerse || ""}`);
            } else {
                // Fallback to current logic if we can't find the verse
                const parsed = parseVbvPath(pathname);
                if (parsed?.type === "p") {
                    router.push(`/p/${parsed.id}`);
                } else if (parsed?.type === "s") {
                    const chapter = chapters.find((c) => c.id === parsed.id);
                    const startPage = chapter ? chapter.pages[0] : 1;
                    router.push(`/p/${startPage}`);
                } else if (parsed?.type === "j") {
                    const juz = JUZ_PAGE_RANGES.find((j) => j.juz === parsed.id);
                    const startPage = juz ? juz.pages[0] : 1;
                    router.push(`/p/${startPage}`);
                } else {
                    router.push(`/p/1`);
                }
            }
        } else {
            // Mushaf Mode -> Verse Mode (use preferred submode)
            const matchPage = pathname.match(/\/p\/([0-9]+)/);
            const page = matchPage ? parseInt(matchPage[1], 10) : 1;
            const submode = prefs.vbvSubmode ?? "s";

            // Find the first verse on this page to preserve position
            const firstVerse = await pageToFirstVerse(page, prefs.mushafCode);

            if (submode === "s") {
                const surahId = pageToSurah(page, chapters);
                router.push(vbvPath("s", surahId, firstVerse));
            } else if (submode === "j") {
                const juzId = pageToJuz(page);
                router.push(vbvPath("j", juzId, firstVerse));
            } else {
                router.push(vbvPath("p", page, firstVerse));
            }
        }
    };

    return (
        <button
            onClick={handleToggle}
            className={cn(
                "relative flex h-8 items-center rounded-full bg-[var(--color-surface)] p-[2px] transition-colors",
                "shadow-inner w-[72px]"
            )}
            aria-label="Toggle Reading Mode"
        >
            <div
                className={cn(
                    "absolute top-[2px] bottom-[2px] w-[34px] rounded-full bg-[var(--color-bg)] shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]",
                    isVerseMode ? "translate-x-[34px]" : "translate-x-0"
                )}
            />

            <div className="relative z-10 flex w-full items-center justify-between px-2">
                <BookOpen
                    className={cn(
                        "h-4 w-4 transition-colors duration-300",
                        !isVerseMode ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
                    )}
                />
                <AlignLeft
                    className={cn(
                        "h-4 w-4 transition-colors duration-300",
                        isVerseMode ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
                    )}
                />
            </div>
        </button>
    );
}
