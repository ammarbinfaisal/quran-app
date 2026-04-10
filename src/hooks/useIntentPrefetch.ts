"use client";
import { useCallback, useRef } from "react";
import { getPreferences } from "@/lib/preferences";
import { prefetchIntentTarget } from "@/lib/prefetch/readerPrefetch";

export function useIntentPrefetch(layer: "L6_intent" | "L9_nav_sheet") {
  const warm = useCallback(
    (page: number) => {
      if (!Number.isFinite(page) || page < 1 || page > 604) return;
      const prefs = getPreferences();
      prefetchIntentTarget(prefs.mushafCode, prefs.dataUsageMode, prefs.translationIds, page, layer);
    },
    [layer],
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageByElement = useRef(new WeakMap<Element, number>());

  const getObserver = useCallback(() => {
    if (observerRef.current) return observerRef.current;
    if (typeof IntersectionObserver === "undefined") return null;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const page = pageByElement.current.get(entry.target);
            if (page !== undefined) {
              warm(page);
              observerRef.current?.unobserve(entry.target);
            }
          }
        }
      },
      { rootMargin: "200px" },
    );
    return observerRef.current;
  }, [warm]);

  const register = useCallback(
    (page: number) =>
      (el: HTMLElement | null) => {
        const observer = getObserver();
        if (!observer || !el) return;
        pageByElement.current.set(el, page);
        observer.observe(el);
      },
    [getObserver],
  );

  return { warm, register };
}
