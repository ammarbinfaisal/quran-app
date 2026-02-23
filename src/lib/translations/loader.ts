// ---------------------------------------------------------------------------
// Translation loader with IndexedDB caching
// ---------------------------------------------------------------------------

import type { TranslationId } from "@/lib/types";
import { TRANSLATION_API_IDS } from "@/lib/types";
import { fetchVerseTranslations } from "@/lib/api";
import { dbGet, dbPut } from "@/lib/offline/storage";
import { loadAbuIyaadTranslation, loadAbuIyaadData } from "./abu-iyaad";

const STORE = "translations";

/**
 * Load a single verse translation.
 *
 * - For "abu-iyaad": checks IndexedDB first (key: `abu-iyaad:<verseKey>`).
 *   If not found, loads the full JSON via the abu-iyaad module (which
 *   fetches /data/abu-iyaad.json once), stores ALL entries in IndexedDB,
 *   and returns the requested verse.
 *
 * - For "saheeh" / "hilali-khan": checks IndexedDB first (key: `<id>:<verseKey>`).
 *   If not found, calls the quran.com API, stores the result, and returns it.
 */
export async function loadTranslation(
  verseKey: string,
  translationId: TranslationId,
): Promise<string> {
  const cacheKey = `${translationId}:${verseKey}`;

  // Check IndexedDB first
  try {
    const cached = await dbGet(STORE, cacheKey);
    if (typeof cached === "string") return cached;
  } catch {
    // IndexedDB unavailable -- fall through to network
  }

  if (translationId === "abu-iyaad") {
    return loadAndCacheAbuIyaad(verseKey);
  }

  // API-based translations (saheeh, hilali-khan)
  const apiId = TRANSLATION_API_IDS[translationId];
  const text = await fetchVerseTranslations(verseKey, apiId);

  // Cache in IndexedDB (fire-and-forget)
  try {
    await dbPut(STORE, cacheKey, text);
  } catch {
    // Silently ignore storage errors
  }

  return text;
}

// ---------------------------------------------------------------------------
// Abu Iyaad: load full JSON, store every entry in IndexedDB
// ---------------------------------------------------------------------------

let abuIyaadStored = false;

async function loadAndCacheAbuIyaad(verseKey: string): Promise<string> {
  const text = await loadAbuIyaadTranslation(verseKey);

  // Store all entries in IndexedDB once
  if (!abuIyaadStored) {
    abuIyaadStored = true;
    try {
      // loadAbuIyaadData returns the in-memory cached JSON (no extra fetch)
      const data = await loadAbuIyaadData();
      const entries = Object.entries(data);
      for (const [key, value] of entries) {
        try {
          await dbPut(STORE, `abu-iyaad:${key}`, value);
        } catch {
          break; // Storage full or unavailable
        }
      }
    } catch {
      abuIyaadStored = false; // Retry next time
    }
  }

  return text;
}
