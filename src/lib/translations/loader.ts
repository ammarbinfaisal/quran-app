// ---------------------------------------------------------------------------
// Translation loader with IndexedDB caching
// ---------------------------------------------------------------------------

import type { TranslationId } from "@/lib/types";
import { TRANSLATION_API_IDS } from "@/lib/types";
import { fetchVerseTranslations } from "@/lib/api";
import { dbGet, dbPut } from "@/lib/offline/storage";
import {
  compactToContent,
  parseTranslationSegments,
  segmentsToContent,
  type TranslationContent,
} from "@/lib/footnotes";
import { loadAbuIyaadData, loadAbuIyaadSegments } from "./abu-iyaad";

const STORE = "translations";
// "v2:" prefix distinguishes pre-parsed TranslationContent from old raw-string entries.
const V2 = "v2:";

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
  const apiId = TRANSLATION_API_IDS[translationId as "saheeh" | "hilali-khan"];
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

let abuIyaadStored = false;

async function loadAndCacheAbuIyaad(
  verseKey: string,
  v2Key: string,
): Promise<TranslationContent> {
  const compact = await loadAbuIyaadSegments(verseKey);
  const content = compactToContent(compact);

  // Store all entries in IDB once (fire-and-forget)
  if (!abuIyaadStored) {
    abuIyaadStored = true;
    try {
      const data = await loadAbuIyaadData();
      for (const [key, segs] of Object.entries(data)) {
        try {
          await dbPut(STORE, `${V2}abu-iyaad:${key}`, compactToContent(segs));
        } catch {
          break; // Storage full or unavailable
        }
      }
    } catch {
      abuIyaadStored = false; // Retry next time
    }
  }

  void v2Key; // already satisfied by the bulk store above
  return content;
}
