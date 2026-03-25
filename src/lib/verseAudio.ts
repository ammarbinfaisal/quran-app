import { playAudio } from "./audio";
import {
  AYAH_RECITER_AUDIO_PATHS,
  type AyahReciterId,
} from "./types";

const AUDIO_CDN_BASE_URL = "https://audio-cdn.tarteel.ai/quran";

function getVerseAudioUrlForReciter(
  verseKey: string,
  reciterId: AyahReciterId,
): string | null {
  const [surahRaw, ayahRaw] = verseKey.split(":");
  const surahNumber = Number.parseInt(surahRaw, 10);
  const ayahNumber = Number.parseInt(ayahRaw, 10);

  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) {
    return null;
  }

  const reciterPath = AYAH_RECITER_AUDIO_PATHS[reciterId];
  const fileName = `${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
  return `${AUDIO_CDN_BASE_URL}/${reciterPath}/${fileName}`;
}

export async function getVerseAudioUrl(
  verseKey: string,
  reciterId: AyahReciterId,
): Promise<string | null> {
  return getVerseAudioUrlForReciter(verseKey, reciterId);
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
