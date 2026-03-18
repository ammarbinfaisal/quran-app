// ---------------------------------------------------------------------------
// Abu Iyaad translation loader
// ---------------------------------------------------------------------------
// The JSON file at /data/abu-iyaad.json has the precomputed shape:
//   { "1:1": ["text", {a: "(annotation)"}, "more text", ...], ... }
// A bare string element is a plain-text run; {a: "..."} is an annotation.
// We fetch it once and cache in a module-level variable.
// ---------------------------------------------------------------------------

import type { CompactSeg } from "@/lib/footnotes";

export interface AbuIyaadNote {
  number: string;
  noteId: string | null;
  text: string;
  author: string | null;
  reference: string | null;
  addedBy: string | null;
  addedOn: string | null;
}

let cache: Record<string, CompactSeg[]> | null = null;
let fetchPromise: Promise<Record<string, CompactSeg[]>> | null = null;

let surahsCache: Record<string, string> | null = null;
let surahsFetchPromise: Promise<Record<string, string>> | null = null;
let notesCache: Record<string, AbuIyaadNote[]> | null = null;
let notesFetchPromise: Promise<Record<string, AbuIyaadNote[]>> | null = null;

/**
 * Load the full Abu Iyaad precomputed segment dictionary.
 * Fetched once and cached in a module variable.
 */
export async function loadAbuIyaadData(): Promise<Record<string, CompactSeg[]>> {
  if (cache) return cache;

  if (!fetchPromise) {
    fetchPromise = fetch("/data/abu-iyaad.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load abu-iyaad.json: ${res.status}`);
        return res.json() as Promise<Record<string, CompactSeg[]>>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }

  return fetchPromise;
}

/**
 * Synchronously return the surah names cache if already loaded, null otherwise.
 */
export function getSurahsCacheSync(): Record<string, string> | null {
  return surahsCache;
}

/**
 * Load Abu Iyaad surah names.
 */
export async function loadAbuIyaadSurahs(): Promise<Record<string, string>> {
  if (surahsCache) return surahsCache;

  if (!surahsFetchPromise) {
    surahsFetchPromise = fetch("/data/abu-iyaad-surahs.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load abu-iyaad-surahs.json: ${res.status}`);
        return res.json() as Promise<Record<string, string>>;
      })
      .then((data) => {
        surahsCache = data;
        return data;
      })
      .catch((err) => {
        surahsFetchPromise = null;
        throw err;
      });
  }

  return surahsFetchPromise;
}

/**
 * Load the Abu Iyaad compact segments for a single verse.
 */
export async function loadAbuIyaadSegments(verseKey: string): Promise<CompactSeg[]> {
  const data = await loadAbuIyaadData();
  return data[verseKey] ?? [];
}

/**
 * Load the Abu Iyaad translation for a single surah name.
 */
export async function loadAbuIyaadSurahName(surahId: number): Promise<string> {
  const data = await loadAbuIyaadSurahs();
  return data[surahId.toString()] ?? "";
}

export async function loadAbuIyaadNotesData(): Promise<Record<string, AbuIyaadNote[]>> {
  if (notesCache) return notesCache;

  if (!notesFetchPromise) {
    notesFetchPromise = fetch("/data/abu-iyaad-notes.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load abu-iyaad-notes.json: ${res.status}`);
        return res.json() as Promise<Record<string, AbuIyaadNote[]>>;
      })
      .then((data) => {
        notesCache = data;
        return data;
      })
      .catch((err) => {
        notesFetchPromise = null;
        throw err;
      });
  }

  return notesFetchPromise;
}

export async function loadAbuIyaadNotes(verseKey: string): Promise<AbuIyaadNote[]> {
  const data = await loadAbuIyaadNotesData();
  return data[verseKey] ?? [];
}
