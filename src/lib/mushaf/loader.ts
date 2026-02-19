import type { MushafCode, MushafPagePayload } from "@/lib/types";
import { dbGet, dbPut } from "@/lib/offline/storage";

// ---------------------------------------------------------------------------
// Page number padding
// ---------------------------------------------------------------------------

function padPage(pageNum: number): string {
  return String(pageNum).padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a mushaf page payload from IndexedDB cache or fetch from the network.
 * Fetches from `/mushaf-data/<code>/p<NNN>.json`.
 */
export async function loadMushafPage(
  code: MushafCode,
  pageNum: number,
): Promise<MushafPagePayload> {
  const cacheKey = `${code}:p${padPage(pageNum)}`;

  // Try IndexedDB first
  try {
    const cached = await dbGet("mushaf-pages", cacheKey);
    if (cached) return cached;
  } catch {
    // IndexedDB unavailable -- fall through to fetch
  }

  // Fetch from network
  const url = `/mushaf-data/${code}/p${padPage(pageNum)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load mushaf page ${code} p${pageNum}: ${res.status}`);
  }
  const payload: MushafPagePayload = await res.json();

  // Cache in IndexedDB for offline use
  try {
    await dbPut("mushaf-pages", cacheKey, payload);
  } catch {
    // Silently ignore cache write failures
  }

  return payload;
}

/**
 * Extract unique verse keys from all words on a page, preserving order.
 */
export function getVerseKeysOnPage(page: MushafPagePayload): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const line of page.lines) {
    for (const word of line.words) {
      if (word.verseKey && !seen.has(word.verseKey)) {
        seen.add(word.verseKey);
        keys.push(word.verseKey);
      }
    }
  }
  return keys;
}

/**
 * Get Uthmani text for a specific verse from page data.
 *
 * TODO: Page data contains QCF glyph codes (code_v1/v2), not Uthmani Unicode text.
 * To get the actual Uthmani text, we need to call the Quran API
 * (e.g. /verses/by_key/{verseKey}?fields=text_uthmani).
 * For now, this returns an empty string.
 */
export function getUthmaniForVerse(
  _page: MushafPagePayload,
  _verseKey: string,
): string {
  // TODO: Fetch Uthmani text from API -- page data only has QCF glyph codes
  return "";
}
