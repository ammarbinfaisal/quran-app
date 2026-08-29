"use client";

import { dbGet, dbPut } from "@/lib/offline/storage";
import { parseSearchIndex, type SearchIndex } from "./format";
import { searchIndex } from "./engine";
import { SEARCH_INDEX_KEY, SEARCH_INDEX_STORE, SEARCH_INDEX_URL } from "./constants";
import type { QuranSearchResponse } from "./types";

// Tiering mirrors src/lib/mushaf/loader.ts: memory -> in-flight -> IndexedDB -> network.
let memoryIndex: SearchIndex | null = null;
let inflight: Promise<SearchIndex | null> | null = null;

async function readStoredIndex(): Promise<ArrayBuffer | null> {
  try {
    const stored = await dbGet<ArrayBuffer | undefined>(SEARCH_INDEX_STORE, SEARCH_INDEX_KEY);
    return stored instanceof ArrayBuffer ? stored : null;
  } catch {
    return null;
  }
}

/** True when the index has been downloaded (bundled with the mushaf download). */
export async function isSearchIndexDownloaded(): Promise<boolean> {
  if (memoryIndex) return true;
  return (await readStoredIndex()) !== null;
}

/** Fetches the index from the network and persists it for offline use. */
export async function downloadSearchIndex(): Promise<ArrayBuffer> {
  const res = await fetch(SEARCH_INDEX_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${SEARCH_INDEX_URL}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  await dbPut(SEARCH_INDEX_STORE, SEARCH_INDEX_KEY, buffer);
  return buffer;
}

/**
 * Returns the local index, loading it from IndexedDB (or, when `allowNetwork`,
 * from the network with write-through to IndexedDB). Null when unavailable.
 */
export function loadClientSearchIndex(options: { allowNetwork: boolean }): Promise<SearchIndex | null> {
  if (memoryIndex) return Promise.resolve(memoryIndex);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      let buffer = await readStoredIndex();
      if (!buffer && options.allowNetwork) {
        try {
          buffer = await downloadSearchIndex();
        } catch {
          buffer = null;
        }
      }
      if (!buffer) return null;
      memoryIndex = parseSearchIndex(buffer);
      return memoryIndex;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearSearchIndexMemoryCache(): void {
  memoryIndex = null;
}

class ApiSearchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

async function fetchApiSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<QuranSearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    signal,
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new ApiSearchError(readErrorMessage(payload, "Search is unavailable right now."), res.status);
  }
  return payload as QuranSearchResponse;
}

function searchLocally(index: SearchIndex, query: string, limit: number): QuranSearchResponse {
  const outcome = searchIndex(index, query, limit);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.response;
}

/**
 * Search the Quran. Prefers the downloaded index (instant, works offline);
 * otherwise calls /api/search, and as a last resort pulls the index from the
 * network and searches locally.
 */
export async function runSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<QuranSearchResponse> {
  const local = await loadClientSearchIndex({ allowNetwork: false });
  if (local) return searchLocally(local, query, limit);

  try {
    return await fetchApiSearch(query, limit, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    // A 4xx is a definitive answer (bad query); only fall back when the API is unreachable/broken.
    if (error instanceof ApiSearchError && error.status < 500) throw error;
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) throw new Error("You are offline. Download the mushaf to search offline.");
    const fetched = await loadClientSearchIndex({ allowNetwork: true });
    if (fetched) return searchLocally(fetched, query, limit);
    throw error;
  }
}
