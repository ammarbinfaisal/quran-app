"use client";

import { useEffect, useRef } from "react";
import { syncUrlToState } from "@/lib/url";
import type { MushafCode } from "@/lib/types";

/**
 * Syncs the current reading position to the browser URL bar (shallow)
 * so the URL is always shareable/bookmarkable.
 *
 * Debounced by 300ms to avoid excessive history.replaceState calls
 * during rapid page flipping.
 */
export function useShallowUrl(
  page: number,
  mushafCode: MushafCode,
  verse?: string | null,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      syncUrlToState(page, mushafCode, verse ?? undefined);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [page, mushafCode, verse]);
}
