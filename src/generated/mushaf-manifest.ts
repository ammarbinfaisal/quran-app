import { TOTAL_PAGES } from "@/lib/constants";
import type { MushafCode } from "@/lib/preferences";

// Generated contract for local mushaf page/font assets.
// scripts/generate-mushaf-assets.ts can rewrite this file.

export type MushafManifestEntry = {
  pageDataPath: string;
  pageProtoPath: string;
  fontPath?: string;
};

export type MushafManifest = Record<number, MushafManifestEntry>;

// CDN font mapping: only v1, v2, and t4 (→ v4 on CDN) have per-page QCF fonts.
// Other codes use Unicode text and a shared global font — no per-page font needed.
//
// Decision: Use CDN URLs instead of local font files because:
//   1. 604 pages × 3 codes = 1,812 font files (~100MB) is impractical for static hosting
//   2. CDN is geographically distributed and cache-optimized
//   3. Fonts are immutable content — perfect for CDN with long cache TTLs
const QCF_FONT_CDN = "https://static.qurancdn.com/fonts/quran/hafs";

const CDN_CODE_MAP: Partial<Record<MushafCode, string>> = {
  v1: "v1",
  v2: "v2",
  t4: "v4",
};

function createManifestForCode(code: MushafCode): MushafManifest {
  const entries: MushafManifest = {};
  const cdnCode = CDN_CODE_MAP[code];

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const pageId = String(page).padStart(3, "0");
    entries[page] = {
      pageDataPath: `/mushaf-data/${code}/p${pageId}.json`,
      pageProtoPath: `/mushaf-data/${code}/p${pageId}.pb`,
      // Per-page CDN font for QCF codes; undefined for unicode-text codes
      fontPath: cdnCode
        ? `${QCF_FONT_CDN}/${cdnCode}/woff2/p${page}.woff2`
        : undefined,
    };
  }

  return entries;
}

const mushafCodes: readonly MushafCode[] = [
  "v1",
  "v2",
  "t4",
  "ut",
  "i5",
  "i6",
  "qh",
  "tj",
];

export const MUSHAF_MANIFESTS: Record<MushafCode, MushafManifest> = {
  v1: createManifestForCode(mushafCodes[0]),
  v2: createManifestForCode(mushafCodes[1]),
  t4: createManifestForCode(mushafCodes[2]),
  ut: createManifestForCode(mushafCodes[3]),
  i5: createManifestForCode(mushafCodes[4]),
  i6: createManifestForCode(mushafCodes[5]),
  qh: createManifestForCode(mushafCodes[6]),
  tj: createManifestForCode(mushafCodes[7]),
};
