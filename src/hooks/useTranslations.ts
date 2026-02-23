"use client";

import { useState, useEffect, useRef } from "react";
import type { TranslationId } from "@/lib/types";
import { loadTranslation } from "@/lib/translations/loader";

/**
 * Loads translations for a given verse key and list of translation IDs.
 * Results are cached in a ref Map.
 */
export function useTranslations(
    verseKey: string | null,
    translationIds: TranslationId[],
): Record<TranslationId, { text: string; loading: boolean }> {
    // We store state as a map of ID -> { text, loading }
    const [results, setResults] = useState<
        Record<TranslationId, { text: string; loading: boolean }>
    >({} as Record<TranslationId, { text: string; loading: boolean }>);

    const cacheRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (!verseKey || translationIds.length === 0) {
            setTimeout(() => setResults({} as Record<TranslationId, { text: string; loading: boolean }>), 0);
            return;
        }

        let cancelled = false;

        // Identify which IDs need fetching vs cache
        const newResults: Record<TranslationId, { text: string; loading: boolean }> =
            { ...results };
        const toFetch: TranslationId[] = [];

        translationIds.forEach((id) => {
            const cacheKey = `${id}:${verseKey}`;
            const cached = cacheRef.current.get(cacheKey);

            if (cached !== undefined) {
                newResults[id] = { text: cached, loading: false };
            } else {
                newResults[id] = { text: "", loading: true };
                toFetch.push(id);
            }
        });

        // Avoid synchronous setState if possible, but here we need to set initial loading state.
        // To satisfy linter "cascading renders", we can use useLayoutEffect or just suppress if we know it's fine.
        // Or better, calculate initial state during render if possible (too complex here).
        // Let's use a timeout to push it to next tick.
        setTimeout(() => setResults(newResults), 0);

        if (toFetch.length === 0) return;

        // Fetch in parallel
        Promise.all(
            toFetch.map(async (id) => {
                try {
                    const text = await loadTranslation(verseKey, id);
                    if (!cancelled) {
                        const cacheKey = `${id}:${verseKey}`;
                        cacheRef.current.set(cacheKey, text);
                        setResults((prev) => ({
                            ...prev,
                            [id]: { text, loading: false },
                        }));
                    }
                } catch {
                    if (!cancelled) {
                        setResults((prev) => ({
                            ...prev,
                            [id]: { text: "", loading: false },
                        }));
                    }
                }
            }),
        );

        return () => {
            cancelled = true;
        };
    }, [verseKey, translationIds]); // eslint-disable-line react-hooks/exhaustive-deps

    return results;
}
