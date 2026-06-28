import { TAFSIR_IDS, type TafsirId } from "@/lib/types";
import { dbGet, dbPut } from "@/lib/offline/storage";

export interface TafsirEntry {
  text: string;
  ayahsStart?: number;
  count?: number;
}

type SurahData = Record<string, TafsirEntry | null>;

const cache = new Map<string, SurahData>();
const inflight = new Map<string, Promise<SurahData>>();

const iraabSvgCache = new Map<string, string | null>();
const iraabSvgInflight = new Map<string, Promise<string | null>>();

function cacheKey(tafsirId: TafsirId, surah: number): string {
  return `${tafsirId}:${surah}`;
}

function idbKey(tafsirId: TafsirId, surah: number): string {
  return `v1:${tafsirId}:${surah}`;
}

async function fetchSurahData(tafsirId: TafsirId, surah: number): Promise<SurahData> {
  const key = cacheKey(tafsirId, surah);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const idbResult = await dbGet<SurahData | undefined>(
        "tafsir-surahs",
        idbKey(tafsirId, surah),
      ).catch(() => undefined);
      if (idbResult) {
        cache.set(key, idbResult);
        return idbResult;
      }

      const res = await fetch(`/data/tafsir/${tafsirId}/${surah}.json`);
      if (!res.ok) {
        cache.set(key, {});
        return {};
      }
      const data: SurahData = await res.json();
      cache.set(key, data);
      dbPut("tafsir-surahs", idbKey(tafsirId, surah), data).catch(() => {});
      return data;
    } catch {
      return {};
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

export function prefetchTafsirSurah(tafsirId: TafsirId, surah: number): Promise<void> {
  return fetchSurahData(tafsirId, surah).then(() => {});
}

export function isTafsirSurahCached(tafsirId: TafsirId, surah: number): boolean {
  return cache.has(cacheKey(tafsirId, surah));
}

export async function loadTafsirEntry(
  tafsirId: TafsirId,
  surah: number,
  ayah: number,
): Promise<TafsirEntry | null> {
  const data = await fetchSurahData(tafsirId, surah);
  return resolveEntry(data, ayah);
}

function resolveEntry(data: SurahData, ayah: number): TafsirEntry | null {
  const direct = data[String(ayah)];
  if (direct !== undefined && direct !== null) return direct;

  for (const entry of Object.values(data)) {
    if (
      entry &&
      entry.ayahsStart != null &&
      entry.count != null &&
      ayah >= entry.ayahsStart &&
      ayah < entry.ayahsStart + entry.count
    ) {
      return entry;
    }
  }

  return null;
}

export async function loadIraabSvg(surah: number, ayah: number): Promise<string | null> {
  const verseKey = `${surah}:${ayah}`;
  const cached = iraabSvgCache.get(verseKey);
  if (cached !== undefined) return cached;

  const pending = iraabSvgInflight.get(verseKey);
  if (pending) return pending;

  const request = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`/data/iraab/verses/${surah}/${ayah}.json`);
      if (!res.ok) {
        iraabSvgCache.set(verseKey, null);
        return null;
      }
      const data = (await res.json()) as { svg?: string } | null;
      const svg = data?.svg ?? null;
      iraabSvgCache.set(verseKey, svg);
      return svg;
    } catch {
      return null;
    } finally {
      iraabSvgInflight.delete(verseKey);
    }
  })();

  iraabSvgInflight.set(verseKey, request);
  return request;
}

// ---------------------------------------------------------------------------
// I3raab availability manifest
// ---------------------------------------------------------------------------

type IraabBitmap = string;

export type IraabAvailability = Record<string, IraabBitmap>;

let iraabAvailabilityPromise: Promise<IraabAvailability> | null = null;
let iraabAvailabilitySync: IraabAvailability | null = null;

export function loadIraabAvailability(): Promise<IraabAvailability> {
  if (iraabAvailabilityPromise) return iraabAvailabilityPromise;
  iraabAvailabilityPromise = (async () => {
    try {
      const res = await fetch("/data/iraab/availability.json");
      if (!res.ok) return {};
      const data = (await res.json()) as IraabAvailability;
      iraabAvailabilitySync = data;
      return data;
    } catch {
      return {};
    }
  })();
  return iraabAvailabilityPromise;
}

export function getIraabAvailabilitySync(): IraabAvailability | null {
  return iraabAvailabilitySync;
}

/**
 * Returns true if i3raab is available, false if known unavailable,
 * or null if unknown (manifest not loaded, ayah beyond bitmap coverage,
 * or an explicit "?" placeholder for an unsampled gap).
 */
export function isIraabAvailable(
  manifest: IraabAvailability | null,
  surah: number,
  ayah: number,
): boolean | null {
  if (!manifest) return null;
  const bitmap = manifest[String(surah)];
  if (!bitmap) return null;
  const ch = bitmap.charAt(ayah - 1);
  if (ch === "1") return true;
  if (ch === "0") return false;
  return null;
}

export function clearTafsirRuntimeCache(): void {
  cache.clear();
  inflight.clear();
  iraabSvgCache.clear();
  iraabSvgInflight.clear();
}

// ---------------------------------------------------------------------------
// Availability manifest
// ---------------------------------------------------------------------------

type SurahBitmap = string;

export type TafsirAvailability = Partial<Record<TafsirId, Record<string, SurahBitmap>>>;

let availabilityPromise: Promise<TafsirAvailability> | null = null;
let availabilitySync: TafsirAvailability | null = null;

export function loadTafsirAvailability(): Promise<TafsirAvailability> {
  if (availabilityPromise) return availabilityPromise;
  availabilityPromise = (async () => {
    try {
      const res = await fetch("/data/tafsir/availability.json");
      if (!res.ok) return {};
      const data = (await res.json()) as TafsirAvailability;
      availabilitySync = data;
      return data;
    } catch {
      return {};
    }
  })();
  return availabilityPromise;
}

export function getTafsirAvailabilitySync(): TafsirAvailability | null {
  return availabilitySync;
}

export function isTafsirAvailable(
  manifest: TafsirAvailability | null,
  tafsirId: TafsirId,
  surah: number,
  ayah: number,
): boolean | null {
  if (!manifest) return null;
  const bitmap = manifest[tafsirId]?.[String(surah)];
  if (!bitmap) return false;
  const ch = bitmap.charAt(ayah - 1);
  if (!ch) return false;
  return ch === "1";
}

export function getAvailableTafsirIds(
  manifest: TafsirAvailability | null,
  surah: number,
  ayah: number,
): TafsirId[] | null {
  if (!manifest) return null;
  return TAFSIR_IDS.filter((id) => isTafsirAvailable(manifest, id, surah, ayah) === true);
}
