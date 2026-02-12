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

function createManifestForCode(code: MushafCode): MushafManifest {
  const entries: MushafManifest = {};

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const pageId = String(page).padStart(3, "0");
    entries[page] = {
      pageDataPath: `/mushaf-data/${code}/p${pageId}.json`,
      pageProtoPath: `/mushaf-data/${code}/p${pageId}.pb`,
      fontPath: `/mushaf-fonts/${code}/p${pageId}.woff2`,
    };
  }

  return entries;
}

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
