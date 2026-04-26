import { TAFSIR_IDS, type TafsirId } from "@/lib/types";

export interface TafsirEntry {
  text: string;
  ayahsStart?: number;
  count?: number;
}

type SurahData = Record<string, TafsirEntry | null>;

const cache = new Map<string, SurahData>();
const inflight = new Map<string, Promise<SurahData>>();

function cacheKey(tafsirId: TafsirId, surah: number): string {
  return `${tafsirId}:${surah}`;
}

async function fetchSurahData(tafsirId: TafsirId, surah: number): Promise<SurahData> {
  const key = cacheKey(tafsirId, surah);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(`/data/tafsir/${tafsirId}/${surah}.json`);
      if (!res.ok) return {};
      const data: SurahData = await res.json();
      cache.set(key, data);
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

/**
 * Warm the in-memory cache for a tafsir's surah file without consuming the
 * result. Subsequent `loadTafsirEntry` calls resolve from memory.
 */
export function prefetchTafsirSurah(tafsirId: TafsirId, surah: number): Promise<void> {
  return fetchSurahData(tafsirId, surah).then(() => {});
}

export function isTafsirSurahCached(tafsirId: TafsirId, surah: number): boolean {
  return cache.has(cacheKey(tafsirId, surah));
}

/**
 * Load tafsir text for a specific ayah. Resolves grouped entries —
 * if the ayah is covered by a group, returns the group's text.
 */
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

  // Ayah is null or missing: look for an explicit grouped entry that covers it.
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

/**
 * Load i'raab SVG for a specific ayah.
 */
export async function loadIraabSvg(surah: number, ayah: number): Promise<string | null> {
  try {
    const res = await fetch(`/data/iraab/${surah}.json`);
    if (!res.ok) return null;
    const data: Record<string, string | null> = await res.json();
    return data[String(ayah)] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Availability manifest
// ---------------------------------------------------------------------------

/** Bitmap string indexed by ayah-1; '1' = covered, '0' = no data. */
type SurahBitmap = string;

/** `{ [tafsirId]: { [surahId: string]: bitmap } }`. */
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

/**
 * `true` when the given (tafsir, surah, ayah) has data according to the
 * manifest. Returns `null` if the manifest hasn't loaded yet so callers can
 * distinguish "unknown" from "known-absent" and show an optimistic UI.
 */
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

/**
 * Which of the 6 tafsirs have data for the given ayah. Returns `null` when
 * the manifest hasn't loaded (caller should treat as "all might be available").
 */
export function getAvailableTafsirIds(
  manifest: TafsirAvailability | null,
  surah: number,
  ayah: number,
): TafsirId[] | null {
  if (!manifest) return null;
  return TAFSIR_IDS.filter((id) => isTafsirAvailable(manifest, id, surah, ayah) === true);
}
