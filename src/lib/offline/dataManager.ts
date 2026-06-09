import { clearMushafPageMemoryCache } from "@/lib/mushaf/loader";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import type { MushafCode, TranslationId } from "@/lib/types";
import {
  removeLemmas,
  removeMorphology,
  removeMushaf,
  removeTranslation,
} from "@/lib/offline/download";
import {
  getDownloadedMushafs,
  getDownloadedTranslations,
  isLemmasDownloaded,
  isMorphologyDownloaded,
} from "@/lib/offline/status";
import { dbClear, dbDelete, dbGetAllKeys } from "@/lib/offline/storage";
import { resetReaderPrefetchState } from "@/lib/prefetch/readerPrefetch";
import { clearTafsirRuntimeCache } from "@/lib/tafsir/loader";
import { clearTranslationRuntimeCache } from "@/lib/translations/runtimeCache";

export interface DataManagerStatus {
  downloadedMushafs: MushafCode[];
  downloadedTranslations: TranslationId[];
  morphologyDownloaded: boolean;
  lemmasDownloaded: boolean;
  hasDownloadedAssets: boolean;
}

async function deleteKeysMatching(
  store: string,
  shouldDelete: (key: string) => boolean,
): Promise<void> {
  const keys = await dbGetAllKeys(store);
  await Promise.all(
    keys
      .filter((key) => shouldDelete(key))
      .map((key) => dbDelete(store, key)),
  );
}

async function clearCacheStorage(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const cacheKeys = await window.caches.keys();
  await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
}

function resetRuntimeCaches() {
  clearMushafPageMemoryCache();
  clearTafsirRuntimeCache();
  clearTranslationRuntimeCache();
  resetReaderPrefetchState();
}

export async function getDataManagerStatus(): Promise<DataManagerStatus> {
  const [downloadedMushafs, downloadedTranslations, morphologyDownloaded, lemmasDownloaded] =
    await Promise.all([
      getDownloadedMushafs(),
      getDownloadedTranslations(),
      isMorphologyDownloaded(),
      isLemmasDownloaded(),
    ]);

  return {
    downloadedMushafs,
    downloadedTranslations,
    morphologyDownloaded,
    lemmasDownloaded,
    hasDownloadedAssets:
      downloadedMushafs.length > 0 ||
      downloadedTranslations.length > 0 ||
      morphologyDownloaded ||
      lemmasDownloaded,
  };
}

export async function purgeTransientData(): Promise<void> {
  const status = await getDataManagerStatus();

  const mushafPrefixesToKeep = status.downloadedMushafs.map(
    (code) => `${code}:${MUSHAF_ASSET_REV}:`,
  );
  const translationPrefixesToKeep = status.downloadedTranslations.flatMap((id) => [
    `${id}:`,
    `v2:${id}:`,
  ]);

  await Promise.all([
    deleteKeysMatching(
      "mushaf-pages",
      (key) => !mushafPrefixesToKeep.some((prefix) => key.startsWith(prefix)),
    ),
    deleteKeysMatching(
      "mushaf-fonts",
      (key) => !mushafPrefixesToKeep.some((prefix) => key.startsWith(prefix)),
    ),
    deleteKeysMatching(
      "translations",
      (key) => !translationPrefixesToKeep.some((prefix) => key.startsWith(prefix)),
    ),
    dbClear("tafsir-surahs"),
    status.morphologyDownloaded ? Promise.resolve() : dbClear("morphology"),
    status.lemmasDownloaded ? Promise.resolve() : dbClear("lemmas"),
  ]);

  await clearCacheStorage();
  resetRuntimeCaches();
}

export async function removeDownloadedAssets(): Promise<void> {
  const status = await getDataManagerStatus();

  await Promise.all([
    ...status.downloadedMushafs.map((code) => removeMushaf(code)),
    ...status.downloadedTranslations.map((id) => removeTranslation(id)),
    status.morphologyDownloaded ? removeMorphology() : Promise.resolve(),
    status.lemmasDownloaded ? removeLemmas() : Promise.resolve(),
  ]);

  resetRuntimeCaches();
}
