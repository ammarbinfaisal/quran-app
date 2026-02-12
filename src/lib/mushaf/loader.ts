import { MUSHAF_MANIFESTS } from "@/generated/mushaf-manifest";
import { TOTAL_PAGES } from "@/lib/constants";
import type { MushafCode } from "@/lib/preferences";

export interface MushafPagePayload {
  page: number;
  mushafCode: MushafCode;
  // Placeholder shape for Phase 1 contract.
  // Phase 2 generation script will emit concrete line/word payloads.
  lines: unknown[];
}

const cache = new Map<string, MushafPagePayload>();

function pageKey(mushafCode: MushafCode, page: number): string {
  return `${mushafCode}:${page}`;
}

function assertPageRange(page: number): asserts page is number {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
    throw new Error(`Invalid mushaf page: ${page}`);
  }
}

export function getMushafManifestEntry(mushafCode: MushafCode, page: number) {
  assertPageRange(page);
  return MUSHAF_MANIFESTS[mushafCode][page];
}

export async function loadMushafPage(
  mushafCode: MushafCode,
  page: number
): Promise<MushafPagePayload | null> {
  assertPageRange(page);

  const cached = cache.get(pageKey(mushafCode, page));
  if (cached) return cached;

  const manifest = getMushafManifestEntry(mushafCode, page);

  try {
    const res = await fetch(manifest.pageDataPath, { cache: "force-cache" });
    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as MushafPagePayload;
    cache.set(pageKey(mushafCode, page), payload);
    return payload;
  } catch {
    return null;
  }
}

export async function preloadNeighborPages(
  mushafCode: MushafCode,
  page: number
): Promise<void> {
  const targets = [page - 1, page, page + 1].filter(
    (p) => p >= 1 && p <= TOTAL_PAGES
  );

  await Promise.allSettled(targets.map((target) => loadMushafPage(mushafCode, target)));
}
