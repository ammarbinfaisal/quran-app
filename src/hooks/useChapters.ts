"use client";

import type { Chapter } from "@/lib/types";
import { getChapters } from "@/lib/chapters";

/**
 * Returns the static list of chapters (synchronous — no loading state).
 */
export function useChapters(): Chapter[] {
    return getChapters();
}
