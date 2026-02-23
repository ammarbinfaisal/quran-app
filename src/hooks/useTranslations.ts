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
): Record<TranslationId, { content: TranslationContent; loading: boolean }> {
    const [results, setResults] = useState<
        Record<TranslationId, { content: TranslationContent; loading: boolean }>
    >({} as Record<TranslationId, { content: TranslationContent; loading: boolean }>);

    const cacheRef = useRef<Map<string, TranslationContent>>(new Map());

    useEffect(() => {
        if (!verseKey || translationIds.length === 0) {
            setTimeout(() => setResults({} as Record<TranslationId, { content: TranslationContent; loading: boolean }>), 0);
            return;
        }

        let cancelled = false;

        const EMPTY: TranslationContent = { segments: [], plain: "" };
        const newResults: Record<TranslationId, { content: TranslationContent; loading: boolean }> =
            { ...results };
        const toFetch: TranslationId[] = [];

        translationIds.forEach((id) => {
            const cacheKey = `${id}:${verseKey}`;
            const cached = cacheRef.current.get(cacheKey);

            if (cached !== undefined) {
                newResults[id] = { content: cached, loading: false };
            } else {
                newResults[id] = { content: EMPTY, loading: true };
                toFetch.push(id);
            }
        });

        setTimeout(() => setResults(newResults), 0);

        if (toFetch.length === 0) return;

        Promise.all(
            toFetch.map(async (id) => {
                try {
                    const content = await loadTranslation(verseKey, id);
                    if (!cancelled) {
                        const cacheKey = `${id}:${verseKey}`;
                        cacheRef.current.set(cacheKey, content);
                        setResults((prev) => ({
                            ...prev,
                            [id]: { content, loading: false },
                        }));
                    }
                } catch {
                    if (!cancelled) {
                        setResults((prev) => ({
                            ...prev,
                            [id]: { content: { segments: [], plain: "" }, loading: false },
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
