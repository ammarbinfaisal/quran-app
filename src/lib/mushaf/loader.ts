import { MUSHAF_MANIFESTS } from "@/generated/mushaf-manifest";
import { TOTAL_PAGES } from "@/lib/constants";
import type { MushafCode } from "@/lib/preferences";
import {
  decodeMushafPagePayloadFromProto,
  parseMushafPagePayload,
  type MushafPagePayload,
} from "@/lib/mushaf/proto";

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

async function loadFromProtobuf(url: string): Promise<MushafPagePayload | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) return null;

    return decodeMushafPagePayloadFromProto(bytes);
  } catch {
    return null;
  }
}

async function loadFromJson(url: string): Promise<MushafPagePayload | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;

    const json = (await res.json()) as unknown;
    return parseMushafPagePayload(json);
  } catch {
    return null;
  }
}

export async function loadMushafPage(
  mushafCode: MushafCode,
  page: number
): Promise<MushafPagePayload | null> {
  assertPageRange(page);

  const cached = cache.get(pageKey(mushafCode, page));
  if (cached) return cached;

  const manifest = getMushafManifestEntry(mushafCode, page);

  const payload =
    (await loadFromProtobuf(manifest.pageProtoPath)) ??
    (await loadFromJson(manifest.pageDataPath));

  if (!payload) return null;

  cache.set(pageKey(mushafCode, page), payload);
  return payload;
}

export async function preloadNeighborPages(
  mushafCode: MushafCode,
  page: number
): Promise<void> {
  const targets = [page - 1, page, page + 1].filter(
    (p) => p >= 1 && p <= TOTAL_PAGES
  );

  await Promise.allSettled(
    targets.map((target) => loadMushafPage(mushafCode, target))
  );
}
