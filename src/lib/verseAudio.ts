import { playAudio } from "./audio";
import {
  AYAH_RECITER_DATA_FILES,
  type AyahReciterId,
} from "./types";

interface VerseAudioEntry {
  audio_url: string;
  segments: number[][];
}

const verseAudioMapCache = new Map<AyahReciterId, Record<string, VerseAudioEntry>>();
const verseAudioMapRequests = new Map<
  AyahReciterId,
  Promise<Record<string, VerseAudioEntry>>
>();

async function loadVerseAudioMap(
  reciterId: AyahReciterId,
): Promise<Record<string, VerseAudioEntry>> {
  const cached = verseAudioMapCache.get(reciterId);
  if (cached) return cached;

  const existing = verseAudioMapRequests.get(reciterId);
  if (existing) return existing;

  const request = fetch(`/data/${AYAH_RECITER_DATA_FILES[reciterId]}`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${AYAH_RECITER_DATA_FILES[reciterId]}: ${res.status}`);
      }
      const map = (await res.json()) as Record<string, VerseAudioEntry>;
      verseAudioMapCache.set(reciterId, map);
      return map;
    })
    .finally(() => {
      verseAudioMapRequests.delete(reciterId);
    });

  verseAudioMapRequests.set(reciterId, request);
  return request;
}

export async function getVerseAudioUrl(
  verseKey: string,
  reciterId: AyahReciterId,
): Promise<string | null> {
  const map = await loadVerseAudioMap(reciterId);
  return map[verseKey]?.audio_url ?? null;
}

export async function playVerseAudio(
  verseKey: string,
  reciterId: AyahReciterId,
): Promise<boolean> {
  const url = await getVerseAudioUrl(verseKey, reciterId);
  if (!url) return false;
  playAudio(url);
  return true;
}
