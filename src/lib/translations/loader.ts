// ---------------------------------------------------------------------------
// Translation loader with IndexedDB caching
// ---------------------------------------------------------------------------

import type { TranslationId } from "@/lib/types";
import { TRANSLATION_API_IDS } from "@/lib/types";
import { fetchPageTranslations, fetchVerseTranslations } from "@/lib/api";
import { dbGet, dbPut, dbPutMany } from "@/lib/offline/storage";
import {
  compactToContent,
  parseTranslationSegments,
  segmentsToContent,
  type TranslationSegment,
  type TranslationContent,
} from "@/lib/footnotes";
import { loadAbuIyaadData, loadAbuIyaadSegments } from "./abu-iyaad";
import { fetchVersePages } from "@/lib/navigation/maps";

const STORE = "translations";
// "v2:" prefix distinguishes pre-parsed TranslationContent from old raw-string entries.
const V2 = "v2:";

type ApiTranslationId = Exclude<TranslationId, "abu-iyaad">;

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

/**
 * Load a single verse translation as a pre-parsed TranslationContent.
 *
 * - For "abu-iyaad": loads from the precomputed segment JSON, caches in IDB.
 * - For "saheeh" / "hilali-khan": checks IDB first (v2 key); if absent, fetches
 *   from the quran.com API, parses into segments, stores in IDB, and returns.
 */
export async function loadTranslation(
  verseKey: string,
  translationId: TranslationId,
): Promise<TranslationContent> {
  const v2Key = `${V2}${translationId}:${verseKey}`;

  // Check IDB for a pre-parsed result
  try {
    const cached = await dbGet<TranslationContent | undefined>(STORE, v2Key);
    if (cached && typeof cached === "object" && "segments" in cached) {
      return cached as TranslationContent;
    }
  } catch {
    // IndexedDB unavailable — fall through
  }

  if (translationId === "abu-iyaad") {
    return loadAndCacheAbuIyaad(verseKey, v2Key);
  }

  // API-based translations (saheeh, hilali-khan)
  const apiTranslationId = translationId as ApiTranslationId;
  const apiId = TRANSLATION_API_IDS[apiTranslationId];

  // Prefer bulk caching by page to avoid per-verse waterfalls in VBV mode.
  const pageLookup = await getVerseStartAndEndPages(verseKey);
  if (pageLookup) {
    const [startPage, endPage] = pageLookup;

    // Try start page first; for spanning verses, fall back to end page.
    const contentFromStart = await loadAndCacheTranslationPage(apiTranslationId, apiId, startPage, verseKey);
    if (contentFromStart) return contentFromStart;
    if (endPage !== startPage) {
      const contentFromEnd = await loadAndCacheTranslationPage(apiTranslationId, apiId, endPage, verseKey);
      if (contentFromEnd) return contentFromEnd;
    }
  }

  // Fallback to by_key (still cached in IDB)
  const rawHtml = await fetchVerseTranslations(verseKey, apiId);
  const segments = parseTranslationSegments(rawHtml, translationId);
  const content = segmentsToContent(segments);

  try {
    await dbPut(STORE, v2Key, content);
  } catch {
    // Silently ignore storage errors
  }

  return content;
}

// ---------------------------------------------------------------------------
// Abu Iyaad: load full JSON once, store every entry in IDB
// ---------------------------------------------------------------------------

let abuIyaadBulkStorePromise: Promise<void> | null = null;

async function loadAndCacheAbuIyaad(
  verseKey: string,
  v2Key: string,
): Promise<TranslationContent> {
  const compact = await loadAbuIyaadSegments(verseKey);
  const content = compactToContent(compact);

  // Cache the requested verse immediately (best effort)
  dbPut(STORE, v2Key, content).catch(() => { });

  // Store all entries in IDB once (actually fire-and-forget)
  if (!abuIyaadBulkStorePromise) {
    abuIyaadBulkStorePromise = (async () => {
      const data = await loadAbuIyaadData();
      const entries: Array<[string, TranslationContent]> = [];
      for (const [key, segs] of Object.entries(data)) {
        entries.push([`${V2}abu-iyaad:${key}`, compactToContent(segs)]);
      }
      try {
        await dbPutMany(STORE, entries);
      } catch {
        // Storage full or unavailable — non-fatal
      }
    })().catch(() => {
      // Retry next time
      abuIyaadBulkStorePromise = null;
    });
  }

  return content;
}

// ---------------------------------------------------------------------------
// API translations: bulk by page (static asset preferred, API fallback)
// ---------------------------------------------------------------------------

const inflightPageLoads = new Map<string, Promise<Map<string, TranslationContent>>>();

/**
 * Best-effort: warm the cache for a page (static asset preferred).
 * This is useful to reduce first-open skeletons in VBV mode.
 */
export function prefetchTranslationPage(
  pageNumber: number,
  translationId: ApiTranslationId,
): void {
  const apiId = TRANSLATION_API_IDS[translationId];
  void getOrLoadTranslationPageMap(translationId, apiId, pageNumber).catch(() => { });
}

async function getVerseStartAndEndPages(verseKey: string): Promise<[number, number] | null> {
  try {
    // Single mushaf exists today, but the verse->page map is mushaf-specific.
    const versePages = await fetchVersePages("v2");
    const lookup = versePages[verseKey];
    if (lookup == null) return null;
    if (Array.isArray(lookup)) return [lookup[0], lookup[1]];
    return [lookup, lookup];
  } catch {
    return null;
  }
}

async function loadStaticTranslationPageMap(
  translationId: ApiTranslationId,
  pageNumber: number,
): Promise<Map<string, TranslationContent> | null> {
  const url = `/data/translations/${translationId}/p${pad3(pageNumber)}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, TranslationSegment[]>;

    const map = new Map<string, TranslationContent>();
    const toStore: Array<[string, TranslationContent]> = [];

    for (const [verseKey, segments] of Object.entries(data)) {
      const content = segmentsToContent(segments);
      map.set(verseKey, content);
      toStore.push([`${V2}${translationId}:${verseKey}`, content]);
    }

    dbPutMany(STORE, toStore).catch(() => { });
    return map;
  } catch {
    return null;
  }
}

async function loadApiTranslationPageMap(
  translationId: ApiTranslationId,
  translationApiId: number,
  pageNumber: number,
): Promise<Map<string, TranslationContent>> {
  const entries = await fetchPageTranslations(pageNumber, translationApiId);
  const map = new Map<string, TranslationContent>();

  const toStore: Array<[string, TranslationContent]> = [];
  for (const e of entries) {
    const rawHtml = e.text ?? "";
    const segments = parseTranslationSegments(rawHtml, translationId);
    const content = segmentsToContent(segments);
    map.set(e.verseKey, content);
    toStore.push([`${V2}${translationId}:${e.verseKey}`, content]);
  }

  dbPutMany(STORE, toStore).catch(() => { });
  return map;
}

async function getOrLoadTranslationPageMap(
  translationId: ApiTranslationId,
  translationApiId: number,
  pageNumber: number,
): Promise<Map<string, TranslationContent>> {
  const inflightKey = `${translationId}:${pageNumber}`;
  const existing = inflightPageLoads.get(inflightKey);

  const p = existing ?? (async () => {
    const staticMap = await loadStaticTranslationPageMap(translationId, pageNumber);
    if (staticMap) return staticMap;
    return loadApiTranslationPageMap(translationId, translationApiId, pageNumber);
  })();

  if (!existing) inflightPageLoads.set(inflightKey, p);

  try {
    return await p;
  } finally {
    if (!existing) inflightPageLoads.delete(inflightKey);
  }
}

async function loadAndCacheTranslationPage(
  translationId: ApiTranslationId,
  translationApiId: number,
  pageNumber: number,
  requestedVerseKey: string,
): Promise<TranslationContent | null> {
  const map = await getOrLoadTranslationPageMap(translationId, translationApiId, pageNumber);
  return map.get(requestedVerseKey) ?? null;
}
