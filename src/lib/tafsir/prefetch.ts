import type { DataUsageMode, TafsirId } from "@/lib/types";
import { getEffectiveDataMode } from "@/lib/prefetch/networkQuality";
import {
  getTafsirAvailabilitySync,
  isTafsirAvailable,
  isTafsirSurahCached,
  loadTafsirAvailability,
  prefetchTafsirSurah,
} from "./loader";
import { normalizeTafsirOrder } from "./order";

type IdleScheduler = (cb: () => void) => void;

const scheduleIdle: IdleScheduler = (cb) => {
  if (typeof window === "undefined") return;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number })
    .requestIdleCallback;
  if (ric) {
    ric(cb, { timeout: 1500 });
  } else {
    window.setTimeout(cb, 120);
  }
};

const SURAH_COUNT = 114;

export interface TafsirPrefetchRequest {
  dataUsageMode: DataUsageMode;
  activeTafsirId: TafsirId;
  surahId: number;
  ayahId: number;
  surahAyahCount: number;
  tafsirOrder?: readonly TafsirId[];
}

export function scheduleTafsirPrefetch(request: TafsirPrefetchRequest): void {
  const effectiveMode = getEffectiveDataMode(request.dataUsageMode);
  if (effectiveMode === "low") return;

  const { surahId, ayahId, surahAyahCount, tafsirOrder } = request;
  const ordered = normalizeTafsirOrder(tafsirOrder);

  scheduleIdle(() => {
    for (const id of ordered) {
      if (isTafsirSurahCached(id, surahId)) continue;
      if (!hasAnyData(id, surahId)) continue;
      void prefetchTafsirSurah(id, surahId);
    }
  });

  if (effectiveMode === "high") {
    scheduleIdle(() => {
      const atEnd = ayahId >= surahAyahCount;
      const atStart = ayahId <= 1;

      if (atEnd && surahId < SURAH_COUNT) {
        warmSurah(surahId + 1, tafsirOrder);
      }
      if (atStart && surahId > 1) {
        warmSurah(surahId - 1, tafsirOrder);
      }
    });
  }
}

function warmSurah(surah: number, tafsirOrder: readonly TafsirId[] | undefined): void {
  for (const id of normalizeTafsirOrder(tafsirOrder)) {
    if (isTafsirSurahCached(id, surah)) continue;
    if (!hasAnyData(id, surah)) continue;
    void prefetchTafsirSurah(id, surah);
  }
}

function hasAnyData(tafsirId: TafsirId, surah: number): boolean {
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return true;
  const bitmap = manifest[tafsirId]?.[String(surah)];
  if (bitmap === undefined) return true;
  return bitmap.includes("1");
}

export function pickAvailableTafsirId(
  requested: TafsirId,
  surah: number,
  ayah: number,
  tafsirOrder?: readonly TafsirId[],
): TafsirId {
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return requested;
  if (isTafsirAvailable(manifest, requested, surah, ayah) === true) return requested;
  const ordered = normalizeTafsirOrder(tafsirOrder).filter((id) => id !== requested);
  for (const id of ordered) {
    if (isTafsirAvailable(manifest, id, surah, ayah) === true) return id;
  }
  return requested;
}

export function pickPreferredAvailableTafsirId(
  surah: number,
  ayah: number,
  tafsirOrder?: readonly TafsirId[],
): TafsirId {
  const ordered = normalizeTafsirOrder(tafsirOrder);
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return ordered[0];
  return (
    ordered.find((id) => isTafsirAvailable(manifest, id, surah, ayah) === true) ??
    ordered[0]
  );
}

function hasAyahData(tafsirId: TafsirId, surah: number, ayah: number): boolean {
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return true;
  return isTafsirAvailable(manifest, tafsirId, surah, ayah) === true;
}

export function scheduleWordTapTafsirPrefetch(
  surah: number,
  ayah: number,
  dataUsageMode: DataUsageMode,
  tafsirOrder?: readonly TafsirId[],
): void {
  const effectiveMode = getEffectiveDataMode(dataUsageMode);
  if (effectiveMode === "low") return;

  scheduleIdle(() => {
    void loadTafsirAvailability()
      .catch(() => null)
      .then(() => {
        for (const id of normalizeTafsirOrder(tafsirOrder)) {
          if (isTafsirSurahCached(id, surah)) continue;
          if (!hasAyahData(id, surah, ayah)) continue;
          void prefetchTafsirSurah(id, surah);
        }
      });
  });
}
