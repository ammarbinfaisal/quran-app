import { MUSHAF_MANIFESTS } from "@/generated/mushaf-manifest";
import { TOTAL_PAGES } from "@/lib/constants";
import type { MushafCode } from "@/lib/preferences";

export function assertPageRange(page: number): asserts page is number {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
    throw new Error(`Invalid mushaf page: ${page}`);
  }
}

export function getManifestEntry(mushafCode: MushafCode, page: number) {
  assertPageRange(page);
  return MUSHAF_MANIFESTS[mushafCode][page];
}

export function getPageFontUrl(mushafCode: MushafCode, page: number): string | null {
  const entry = getManifestEntry(mushafCode, page);
  return entry.fontPath ?? null;
}

export function getPagePayloadUrls(mushafCode: MushafCode, page: number): {
  protoUrl: string;
  jsonUrl: string;
} {
  const entry = getManifestEntry(mushafCode, page);
  return { protoUrl: entry.pageProtoPath, jsonUrl: entry.pageDataPath };
}

export function getPageFontFamily(mushafCode: MushafCode, page: number): string {
  assertPageRange(page);
  return `Mushaf_${mushafCode}_p${String(page).padStart(3, "0")}`;
}

