"use client";

import { useState, useEffect } from "react";
import { loadAbuIyaadSurahs, getSurahsCacheSync } from "@/lib/translations/abu-iyaad";

export function useAbuIyaadSurahs(): Record<string, string> | null {
    const [surahs, setSurahs] = useState<Record<string, string> | null>(getSurahsCacheSync);

    useEffect(() => {
        let mounted = true;
        loadAbuIyaadSurahs()
            .then((data) => {
                if (mounted) setSurahs(data);
            })
            .catch((err) => {
                console.error("Failed to load Abu Iyaad surahs", err);
            });
        return () => {
            mounted = false;
        };
    }, []);

    return surahs;
}
