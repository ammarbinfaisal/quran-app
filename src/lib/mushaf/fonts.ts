import type { MushafCode } from "@/lib/types";
import { QCF_CODES } from "@/lib/types";
import {
  FONT_CDN,
  FONT_PRELOAD_RADIUS,
  FONT_CLEANUP_RADIUS,
  TOTAL_PAGES,
} from "@/lib/constants";
import { dbGet } from "@/lib/offline/storage";

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
  if (code === "v1") return `${FONT_CDN}/v1/woff2/p${pageNum}.woff2`;
  if (code === "v2") return `${FONT_CDN}/v2/woff2/p${pageNum}.woff2`;
  if (code === "t4") return `${FONT_CDN}/v4/woff2/p${pageNum}.woff2`;
  return `${FONT_CDN}/v2/woff2/p${pageNum}.woff2`;
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
  return '"Amiri", "Traditional Arabic", serif';
}

/**
 * Load a QCF font for a specific mushaf page using the FontFace API.
 * No-ops if the font is already loaded.
 */
export async function loadQcfFont(
  code: MushafCode,
  pageNum: number,
): Promise<void> {
  if (!isQcfCode(code)) return;
  if (typeof document === "undefined") return;

  const name = fontName(code, pageNum);

  // Check if already loaded
  try {
    if (document.fonts.check(`16px "${name}"`)) return;
  } catch {
    // fonts.check can throw if the font name has never been registered -- continue
  }

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
  try {
    const cached = await dbGet("mushaf-fonts", idbKey);
    if (cached instanceof ArrayBuffer) {
      source = cached;
    } else if (
      cached &&
      typeof cached === "object" &&
      "buffer" in (cached as any) &&
      (cached as any).buffer instanceof ArrayBuffer
    ) {
      source = (cached as any).buffer as ArrayBuffer;
    }
  } catch {
    // IndexedDB unavailable -- use network
  }

  const face = new FontFace(name, source, { display: "block" });

  document.fonts.add(face);
  await face.load();
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
      loadQcfFont(code, page).catch(() => {});
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
  }
}
