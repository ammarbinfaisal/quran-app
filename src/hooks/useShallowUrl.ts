"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

function buildVUrl(type: "p" | "s" | "j", id: number, verse?: string | null) {
  const qs = verse ? `?verse=${encodeURIComponent(verse)}` : "";
  return `/v/${type}/${id}${qs}`;
}

function buildPUrl(page: number, verse?: string | null) {
  const qs = verse ? `?verse=${encodeURIComponent(verse)}` : "";
  return `/p/${page}${qs}`;
}

/** Sync only when you're already on /v/... */
export function useVbvShallowUrl(type: "p" | "s" | "j", id: number, verse?: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    // guard: don't let /v sync run while on /p or other routes
    if (!pathname.startsWith("/v/")) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const url = buildVUrl(type, id, verse);
      if (url !== lastUrlRef.current) {
        lastUrlRef.current = url;
        router.replace(url, { scroll: false });
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router, pathname, type, id, verse]);
}

/** Sync only when you're already on /p/... */
export function useMushafShallowUrl(page: number, verse?: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    if (!pathname.startsWith("/p/")) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const url = buildPUrl(page, verse);
      if (url !== lastUrlRef.current) {
        lastUrlRef.current = url;
        router.replace(url, { scroll: false });
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router, pathname, page, verse]);
}
