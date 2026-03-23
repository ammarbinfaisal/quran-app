import { playAudio } from "./audio";

interface VerseAudioEntry {
  audio_url: string;
  segments: number[][];
}

let verseAudioMap: Record<string, VerseAudioEntry> | null = null;

async function loadVerseAudioMap(): Promise<Record<string, VerseAudioEntry>> {
  if (verseAudioMap) return verseAudioMap;
  const res = await fetch(
    "/data/ayah-recitation-abdul-basit-abdul-samad-murattal-hafs-950.json",
  );
  verseAudioMap = (await res.json()) as Record<string, VerseAudioEntry>;
  return verseAudioMap;
}

export async function getVerseAudioUrl(verseKey: string): Promise<string | null> {
  const map = await loadVerseAudioMap();
  return map[verseKey]?.audio_url ?? null;
}

export async function playVerseAudio(verseKey: string): Promise<boolean> {
  const url = await getVerseAudioUrl(verseKey);
  if (!url) return false;
  playAudio(url);
  return true;
}
