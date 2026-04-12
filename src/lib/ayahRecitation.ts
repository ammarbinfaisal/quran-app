import { dbGet, dbPut } from "@/lib/offline/storage";
import type { AyahReciterId } from "@/lib/types";

export type { AyahReciterId };

const TARTEEL_CDN = "https://audio-cdn.tarteel.ai/quran";

export const AYAH_RECITERS: Record<
  AyahReciterId,
  { label: string; dataFile: string | null; cdnPath: string }
> = {
  "maher-al-mu-aiqly": {
    label: "Maher Al Mu'aiqly",
    dataFile: "/data/ayah-recitations/maher-al-mu-aiqly.json",
    cdnPath: `${TARTEEL_CDN}/maherAlMuaiqly`,
  },
  "khalifa-al-tunaiji": {
    label: "Khalifa Al Tunaiji",
    dataFile: "/data/ayah-recitations/khalifa-al-tunaiji.json",
    cdnPath: `${TARTEEL_CDN}/khalifaAlTunaiji`,
  },
  "saad-al-ghamdi": {
    label: "Saad Al Ghamdi",
    dataFile: "/data/ayah-recitations/saad-al-ghamdi.json",
    cdnPath: `${TARTEEL_CDN}/ghamadi`,
  },
  "abdul-basit": {
    label: "Abdul Basit Abdul Samad",
    dataFile: null,
    cdnPath: `${TARTEEL_CDN}/abdulBasitMurattal`,
  },
  husary: {
    label: "Mahmoud Khalil al-Husary",
    dataFile: null,
    cdnPath: `${TARTEEL_CDN}/husary`,
  },
  minshawi: {
    label: "Muhammad Siddiq al-Minshawi",
    dataFile: null,
    cdnPath: `${TARTEEL_CDN}/minshawyMurattal`,
  },
};

export const DEFAULT_AYAH_RECITER: AyahReciterId = "maher-al-mu-aiqly";

/**
 * Word timing segment: [wordIndex, startMs, endMs]
 * wordIndex is 1-based
 */
export type WordSegment = [number, number, number];

export interface AyahRecitationEntry {
  surah_number: number;
  ayah_number: number;
  audio_url: string;
  duration: number | null;
  segments: WordSegment[];
}

export type AyahRecitationMap = Record<string, AyahRecitationEntry>;

// In-memory cache for loaded recitation data
const recitationCache = new Map<AyahReciterId, AyahRecitationMap>();

/**
 * Load all ayah recitation data for a given reciter.
 * Data is cached in memory and IndexedDB.
 * For CDN-only reciters (no dataFile), returns an empty map.
 */
export async function loadAyahRecitations(
  reciterId: AyahReciterId
): Promise<AyahRecitationMap> {
  const reciter = AYAH_RECITERS[reciterId];
  if (!reciter) {
    throw new Error(`Unknown reciter: ${reciterId}`);
  }

  // CDN-only reciters don't have pre-built data
  if (!reciter.dataFile) {
    return {};
  }

  // Check memory cache first
  const cached = recitationCache.get(reciterId);
  if (cached) return cached;

  // Check IndexedDB cache
  const cacheKey = `ayah-recitations:${reciterId}`;
  try {
    const dbCached = await dbGet<AyahRecitationMap>("misc", cacheKey);
    if (dbCached) {
      recitationCache.set(reciterId, dbCached);
      return dbCached;
    }
  } catch {
    // IDB unavailable
  }

  // Fetch from network
  const res = await fetch(reciter.dataFile);
  if (!res.ok) {
    throw new Error(`Failed to load recitation data: ${res.status}`);
  }

  const data: AyahRecitationMap = await res.json();

  // Cache in memory and IndexedDB
  recitationCache.set(reciterId, data);
  dbPut("misc", cacheKey, data).catch(() => {});

  return data;
}

/**
 * Build CDN audio URL for a verse.
 */
function buildCdnAudioUrl(cdnPath: string, verseKey: string): string {
  const [surahStr, ayahStr] = verseKey.split(":");
  const surah = Number.parseInt(surahStr, 10);
  const ayah = Number.parseInt(ayahStr, 10);
  const fileName = `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;
  return `${cdnPath}/${fileName}`;
}

/**
 * Get recitation data for a specific verse.
 * For reciters with dataFile, uses cached data with word timing.
 * For CDN-only reciters, constructs audio URL dynamically (no word timing).
 */
export async function getAyahRecitation(
  reciterId: AyahReciterId,
  verseKey: string
): Promise<AyahRecitationEntry | null> {
  const reciter = AYAH_RECITERS[reciterId];
  if (!reciter) return null;

  const [surahStr, ayahStr] = verseKey.split(":");
  const surah = Number.parseInt(surahStr, 10);
  const ayah = Number.parseInt(ayahStr, 10);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;

  // For reciters with dataFile, try to get cached data with word timing
  if (reciter.dataFile) {
    const data = await loadAyahRecitations(reciterId);
    const entry = data[verseKey];
    if (entry) return entry;
  }

  // Fall back to CDN URL (no word timing)
  return {
    surah_number: surah,
    ayah_number: ayah,
    audio_url: buildCdnAudioUrl(reciter.cdnPath, verseKey),
    duration: null,
    segments: [],
  };
}

/**
 * Get recitation data for a range of verses.
 */
export async function getAyahRecitationsInRange(
  reciterId: AyahReciterId,
  startVerse: string,
  endVerse: string
): Promise<AyahRecitationEntry[]> {
  const data = await loadAyahRecitations(reciterId);

  const [startSurah, startAyah] = startVerse.split(":").map(Number);
  const [endSurah, endAyah] = endVerse.split(":").map(Number);

  const entries: AyahRecitationEntry[] = [];

  for (const [verseKey, entry] of Object.entries(data)) {
    const [surah, ayah] = verseKey.split(":").map(Number);

    // Check if verse is within range
    if (surah < startSurah || surah > endSurah) continue;
    if (surah === startSurah && ayah < startAyah) continue;
    if (surah === endSurah && ayah > endAyah) continue;

    entries.push(entry);
  }

  // Sort by surah and ayah
  entries.sort((a, b) => {
    if (a.surah_number !== b.surah_number) {
      return a.surah_number - b.surah_number;
    }
    return a.ayah_number - b.ayah_number;
  });

  return entries;
}

/**
 * Preload recitation data for a reciter in the background.
 */
export function preloadAyahRecitations(reciterId: AyahReciterId): void {
  loadAyahRecitations(reciterId).catch(() => {});
}
