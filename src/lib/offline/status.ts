import {
  type MushafCode,
  type TranslationId,
  type AyahReciterId,
  type OfflineStatus,
  MUSHAF_CODES,
  SUPPORTED_AYAH_RECITERS,
} from "@/lib/types";
import { dbGet } from "@/lib/offline/storage";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import { ensureCurrentMushafAssetRevision } from "@/lib/offline/mushafRevision";

const ALL_TRANSLATION_IDS: TranslationId[] = ["saheeh", "hilali-khan", "abu-iyaad"];

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

export async function getDownloadedMushafs(): Promise<MushafCode[]> {
  await ensureCurrentMushafAssetRevision();

  const downloaded: MushafCode[] = [];
  for (const code of MUSHAF_CODES) {
    const value = await dbGet("mushaf-pages", `${code}:${MUSHAF_ASSET_REV}:complete`);
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

export async function getDownloadedRecitations(): Promise<AyahReciterId[]> {
  const downloaded: AyahReciterId[] = [];
  for (const id of SUPPORTED_AYAH_RECITERS) {
    try {
      const value = await dbGet("recitation-audio", `${id}:complete`);
      if (value) downloaded.push(id);
    } catch {
      // store may not exist yet
    }
  }
  return downloaded;
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
