"use client";

import { useState, useEffect, useRef } from "react";
import type { TranslationId } from "@/lib/types";
import type { TranslationContent } from "@/lib/footnotes";
import { loadTranslation } from "@/lib/translations/loader";

/**
 * Loads translations for a given verse key and list of translation IDs.
 * Returns pre-parsed TranslationContent (segments + plain text).
 * Results are cached in a ref Map.
 */
export function useTranslations(
    verseKey: string | null,
    translationIds: TranslationId[],
): Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }> {
    const [results, setResults] = useState<
        Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }>
    >({} as Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }>);

    const cacheRef = useRef<Map<string, TranslationContent>>(new Map());

    useEffect(() => {
        if (!verseKey || translationIds.length === 0) {
            setTimeout(() => {
                setResults({} as Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }>);
            }, 0);
            return;
        }

        let cancelled = false;
        let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

        const EMPTY: TranslationContent = { segments: [], plain: "" };
        const toFetch: TranslationId[] = [];
        const initial: Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }> =
            {} as Record<TranslationId, { content: TranslationContent; loading: boolean; showSkeleton: boolean }>;

        translationIds.forEach((id) => {
            const cacheKey = `${id}:${verseKey}`;
            const cached = cacheRef.current.get(cacheKey);

            if (cached !== undefined) {
                initial[id] = { content: cached, loading: false, showSkeleton: false };
            } else {
                initial[id] = { content: EMPTY, loading: true, showSkeleton: false };
                toFetch.push(id);
            }
        });

        setTimeout(() => setResults(initial), 0);

        if (toFetch.length === 0) return;

        skeletonTimer = setTimeout(() => {
            if (cancelled) return;
            setResults((prev) => {
                const next = { ...prev };
                for (const id of toFetch) {
                    const row = next[id];
                    if (row && row.loading) {
                        next[id] = { ...row, showSkeleton: true };
                    }
                }
                return next;
            });
        }, 140);

        Promise.all(
            toFetch.map(async (id) => {
                try {
                    const content = await loadTranslation(verseKey, id);
                    if (!cancelled) {
                        const cacheKey = `${id}:${verseKey}`;
                        cacheRef.current.set(cacheKey, content);
                        setResults((prev) => ({
                            ...prev,
                            [id]: { content, loading: false, showSkeleton: false },
                        }));
                    }
                } catch {
                    if (!cancelled) {
                        setResults((prev) => ({
                            ...prev,
                            [id]: { content: { segments: [], plain: "" }, loading: false, showSkeleton: false },
                        }));
                    }
                }
            }),
        );

        return () => {
            cancelled = true;
            if (skeletonTimer) clearTimeout(skeletonTimer);
        };
    }, [verseKey, translationIds]);

    return results;
}
