import type { TafsirId } from "@/lib/types";

export interface TafsirEntry {
  text: string;
  ayahsStart?: number;
  count?: number;
}

type SurahData = Record<string, TafsirEntry | null>;

const cache = new Map<string, SurahData>();

function cacheKey(tafsirId: TafsirId, surah: number): string {
  return `${tafsirId}:${surah}`;
}

async function fetchSurahData(tafsirId: TafsirId, surah: number): Promise<SurahData> {
  const key = cacheKey(tafsirId, surah);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`/data/tafsir/${tafsirId}/${surah}.json`);
    if (!res.ok) return {};
    const data: SurahData = await res.json();
    cache.set(key, data);
    return data;
  } catch {
    return {};
  }
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
  const key = String(ayah);

  const direct = data[key];
  if (direct !== undefined && direct !== null) return direct;

  // If null, this ayah is covered by a preceding grouped entry — find it
  if (direct === null) {
    for (const [, entry] of Object.entries(data)) {
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
