import type { DataUsageMode, TafsirId } from "@/lib/types";
import { TAFSIR_IDS } from "@/lib/types";
import { getEffectiveDataMode } from "@/lib/prefetch/networkQuality";
import {
  getTafsirAvailabilitySync,
  isTafsirAvailable,
  isTafsirSurahCached,
  prefetchTafsirSurah,
} from "./loader";

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
  /** Total ayahs in the current surah, for boundary detection. */
  surahAyahCount: number;
}

/**
 * Warms the surah-level tafsir caches so switching tafsir tabs or stepping
 * to an adjacent ayah feels instant. Strategy scales with the user's data
 * mode:
 *
 * - **low**: no prefetch — we only ever fetch what the current view renders.
 * - **balanced**: prefetch the other 5 tafsirs' surah files for the current
 *   surah (tab switches become instant).
 * - **high**: also prefetch adjacent surahs' files for every tafsir the user
 *   is likely to cross into via prev/next navigation.
 *
 * Network-quality downgrades (`getEffectiveDataMode`) are honored so mobile
 * on a slow connection won't aggressively prefetch even if the user picked
 * "high".
 */
export function scheduleTafsirPrefetch(request: TafsirPrefetchRequest): void {
  const effectiveMode = getEffectiveDataMode(request.dataUsageMode);
  if (effectiveMode === "low") return;

  const { activeTafsirId, surahId, ayahId, surahAyahCount } = request;

  scheduleIdle(() => {
    // Always prefetch the other tafsirs for the current surah so the switcher
    // responds instantly.
    for (const id of TAFSIR_IDS) {
      if (id === activeTafsirId) continue;
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
        warmSurah(surahId + 1);
      }
      if (atStart && surahId > 1) {
        warmSurah(surahId - 1);
      }
    });
  }
}

function warmSurah(surah: number): void {
  for (const id of TAFSIR_IDS) {
    if (isTafsirSurahCached(id, surah)) continue;
    if (!hasAnyData(id, surah)) continue;
    void prefetchTafsirSurah(id, surah);
  }
}

/**
 * Skip surahs a tafsir has no coverage of so we don't spend network on files
 * we already know are empty.
 */
function hasAnyData(tafsirId: TafsirId, surah: number): boolean {
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return true; // no manifest yet — be optimistic
  const bitmap = manifest[tafsirId]?.[String(surah)];
  if (bitmap === undefined) return true; // unknown surah in manifest — try anyway
  return bitmap.includes("1");
}

/**
 * Returns the first tafsir that has data for the requested ayah. Falls back
 * to the requested tafsir when availability is unknown.
 */
export function pickAvailableTafsirId(
  requested: TafsirId,
  surah: number,
  ayah: number,
): TafsirId {
  const manifest = getTafsirAvailabilitySync();
  if (!manifest) return requested;
  if (isTafsirAvailable(manifest, requested, surah, ayah) === true) return requested;
  for (const id of TAFSIR_IDS) {
    if (isTafsirAvailable(manifest, id, surah, ayah) === true) return id;
  }
  return requested;
}
