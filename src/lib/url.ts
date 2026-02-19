import type { MushafCode } from "./types";

/**
 * Shallow-copy page/mushaf/verse to the URL bar without triggering navigation.
 * The URL is purely for sharing/bookmarking -- it does not drive app state.
 */
export function syncUrlToState(
  page: number,
  mushaf: MushafCode,
  verse?: string,
): void {
  if (typeof window === "undefined") return;
  let path = `/${page}/${mushaf}`;
  const params = new URLSearchParams();
  if (verse) params.set("verse", verse);
  const qs = params.toString();
  if (qs) path += `?${qs}`;
  window.history.replaceState(null, "", path);
}

/**
 * Parse the current URL to extract page, mushaf, and optional verse highlight.
 */
export function parseUrlState(): {
  page: number | null;
  mushaf: MushafCode | null;
  verse: string | null;
} {
  if (typeof window === "undefined") return { page: null, mushaf: null, verse: null };

  const parts = window.location.pathname.split("/").filter(Boolean);
  const page = parts[0] ? parseInt(parts[0], 10) : null;
  const mushaf = (parts[1] as MushafCode) ?? null;
  const params = new URLSearchParams(window.location.search);
  const verse = params.get("verse");

  return {
    page: page && !isNaN(page) ? page : null,
    mushaf,
    verse,
  };
}
