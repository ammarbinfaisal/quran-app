import type { MushafCode } from "@/lib/types";
import { QCF_CODES } from "@/lib/types";
import {
  FONT_PRELOAD_RADIUS,
  FONT_CLEANUP_RADIUS,
  TOTAL_PAGES,
} from "@/lib/constants";
import { dbGet, dbPut } from "@/lib/offline/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padPage(pageNum: number): string {
  return String(pageNum).padStart(3, "0");
}

function fontName(code: MushafCode, pageNum: number): string {
  return `QCF_${code}_P${pageNum}`;
}

function mushafPageKey(pageNum: number): string {
  return `p${padPage(pageNum)}`;
}

export function getQcfFontUrl(code: MushafCode, pageNum: number): string {
  const padded = padPage(pageNum);
  return `/mushaf-fonts/${code}/p${padded}.woff2`;
}

export function getUnicodeFontUrl(_code: MushafCode): string {
  return "";
}

export function getUnicodeFontFamily(_code: MushafCode): string {
  return '"Amiri", "Traditional Arabic", serif';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the mushaf code uses per-page QCF glyph fonts.
 */
export function isQcfCode(code: MushafCode): boolean {
  return (QCF_CODES as readonly string[]).includes(code);
}

/**
 * Returns the CSS font-family string for a given mushaf code and page.
 * For QCF codes this is the per-page font name; for others it falls back
 * to a generic Arabic font stack.
 */
export function getFontFamily(code: MushafCode, pageNum: number): string {
  if (isQcfCode(code)) {
    return fontName(code, pageNum);
  }
  return getUnicodeFontFamily(code);
}

// Track fonts we've already started loading to avoid duplicate work
const loadedFonts = new Set<string>();

/**
 * Load a QCF font for a specific mushaf page using the FontFace API.
 * No-ops if the font is already loaded.
 *
 * If the font is fetched from CDN (not cached), the raw bytes are
 * written to IndexedDB so subsequent loads are instant and work offline.
 */
export async function loadQcfFont(
  code: MushafCode,
  pageNum: number,
): Promise<void> {
  if (!isQcfCode(code)) return;
  if (typeof document === "undefined") return;

  const name = fontName(code, pageNum);

  // Already loaded or loading — skip
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);

  // Check if already being loaded (exists in the font set but not yet loaded)
  for (const f of document.fonts) {
    if (f.family === name) {
      await f.loaded;
      return;
    }
  }

  const idbKey = `${code}:${mushafPageKey(pageNum)}`;
  const url = getQcfFontUrl(code, pageNum);

  let source: string | ArrayBuffer = `url(${url})`;
  let fromCache = false;

  try {
    const cached = await dbGet("mushaf-fonts", idbKey);
    if (cached instanceof ArrayBuffer) {
      source = cached;
      fromCache = true;
    } else if (
      cached &&
      typeof cached === "object" &&
      "buffer" in cached &&
      (cached as { buffer: unknown }).buffer instanceof ArrayBuffer
    ) {
      source = (cached as { buffer: ArrayBuffer }).buffer;
      fromCache = true;
    }
  } catch {
    // IndexedDB unavailable -- use network
  }

  // If not cached, fetch the font bytes and cache for offline use
  if (!fromCache) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        source = buf;
        // Write to IDB in the background — don't block font rendering
        dbPut("mushaf-fonts", idbKey, buf).catch(() => { });
      }
    } catch {
      // Network unavailable — the FontFace constructor will use the URL
      // string as a last-resort fallback (won't work offline, but better
      // than crashing)
      source = `url(${url})`;
    }
  }

  const face = new FontFace(name, source, { display: "block" });

  document.fonts.add(face);
  await face.load();
}

/**
 * Load a shared Unicode font.
 */
export async function loadUnicodeFont(code: MushafCode): Promise<void> {
  if (isQcfCode(code)) return;
  if (typeof document === "undefined") return;

  const name = getUnicodeFontFamily(code);
  const url = getUnicodeFontUrl(code);
  if (!url) return;

  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);

  // Check if already in document
  for (const f of document.fonts) {
    if (f.family === name) return;
  }

  const face = new FontFace(name, `url(${url})`, { display: "swap" });
  document.fonts.add(face);
  await face.load();
}

/**
 * Returns true if the font family is already loaded in the document.
 */
export function isFontLoaded(fontFamily: string): boolean {
  if (typeof document === "undefined") return false;
  for (const f of document.fonts) {
    if (f.family === fontFamily && f.status === "loaded") return true;
  }
  return false;
}

/**
 * Remove a QCF font from the document font set to free memory.
 */
export function unloadQcfFont(code: MushafCode, pageNum: number): void {
  if (typeof document === "undefined") return;

  const name = fontName(code, pageNum);

  for (const f of document.fonts) {
    if (f.family === name) {
      document.fonts.delete(f);
      break;
    }
  }
  loadedFonts.delete(name);
}

/**
 * Preload fonts for pages adjacent to the current page and clean up
 * fonts that are far away to save memory.
 *
 * @param code      Mushaf code
 * @param currentPage  Current page number
 * @param radius    Number of pages to preload in each direction (default: FONT_PRELOAD_RADIUS)
 */
export function preloadAdjacentFonts(
  code: MushafCode,
  currentPage: number,
  radius: number = FONT_PRELOAD_RADIUS,
): void {
  if (!isQcfCode(code)) return;

  // Preload pages within radius
  for (let offset = -radius; offset <= radius; offset++) {
    const page = currentPage + offset;
    if (page >= 1 && page <= TOTAL_PAGES) {
      // Fire and forget -- preloading is best-effort
      loadQcfFont(code, page).catch(() => { });
    }
  }

  // Cleanup fonts more than FONT_CLEANUP_RADIUS pages away
  if (typeof document === "undefined") return;

  const toDelete: FontFace[] = [];
  const prefix = `QCF_${code}_P`;

  for (const f of document.fonts) {
    if (!f.family.startsWith(prefix)) continue;

    const pageStr = f.family.slice(prefix.length);
    const page = parseInt(pageStr, 10);
    if (isNaN(page)) continue;

    if (Math.abs(page - currentPage) > FONT_CLEANUP_RADIUS) {
      toDelete.push(f);
    }
  }

  for (const f of toDelete) {
    document.fonts.delete(f);
    loadedFonts.delete(f.family);
  }
}
