import {
  type MushafCode,
  type TranslationId,
  type OfflineStatus,
  MUSHAF_CODES,
} from "@/lib/types";
import { dbGet } from "@/lib/offline/storage";

const ALL_TRANSLATION_IDS: TranslationId[] = ["saheeh", "hilali-khan", "abu-iyaad"];

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

export async function getDownloadedMushafs(): Promise<MushafCode[]> {
  const downloaded: MushafCode[] = [];
  for (const code of MUSHAF_CODES) {
    const value = await dbGet("mushaf-pages", `${code}:complete`);
    if (value) {
      downloaded.push(code);
    }
  }
  return downloaded;
}

export async function getDownloadedTranslations(): Promise<TranslationId[]> {
  const downloaded: TranslationId[] = [];
  for (const id of ALL_TRANSLATION_IDS) {
    const value = await dbGet("translations", `${id}:complete`);
    if (value) {
      downloaded.push(id);
    }
  }
  return downloaded;
}

export async function isMorphologyDownloaded(): Promise<boolean> {
  try {
    const value = await dbGet("morphology", "complete");
    return !!value;
  } catch {
    return false;
  }
}

export async function isLemmasDownloaded(): Promise<boolean> {
  try {
    const value = await dbGet("lemmas", "complete");
    return !!value;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Combined status
// ---------------------------------------------------------------------------

export async function getOfflineStatus(): Promise<OfflineStatus> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const [downloadedMushafs, downloadedTranslations] = await Promise.all([
    getDownloadedMushafs(),
    getDownloadedTranslations(),
  ]);

  return {
    online,
    downloadedMushafs,
    downloadedTranslations,
  };
}
