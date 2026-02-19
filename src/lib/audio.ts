import { fetchChapterAudio } from "./api";
import { RECITER_IDS } from "./constants";
import type { AudioFile } from "./types";

let audioElement: HTMLAudioElement | null = null;
let currentAudio: AudioFile | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = "none";
  }
  return audioElement;
}

export async function loadChapterAudio(chapterId: number): Promise<AudioFile> {
  const af = await fetchChapterAudio(RECITER_IDS.HUSARY, chapterId);
  currentAudio = af;
  return af;
}

export function playAudio(url: string): void {
  const el = getAudio();
  if (el.src !== url) {
    el.src = url;
  }
  el.play();
}

export function pauseAudio(): void {
  getAudio().pause();
}

export function isPlaying(): boolean {
  return audioElement ? !audioElement.paused : false;
}

export function seekAudio(time: number): void {
  getAudio().currentTime = time;
}

export function getAudioElement(): HTMLAudioElement | null {
  return audioElement;
}

export function getCurrentAudio(): AudioFile | null {
  return currentAudio;
}
