import { TOTAL_PAGES } from "@/lib/constants";
import { fetchPageTranslations } from "@/lib/api";
import {
  type MushafCode,
  type TranslationId,
  type DownloadProgress,
  QCF_CODES,
  TRANSLATION_API_IDS,
} from "@/lib/types";
import { dbPut, dbDelete, dbGetAllKeys, dbGet } from "@/lib/offline/storage";
import { getQcfFontUrl } from "@/lib/mushaf/fonts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zero-padded page number, e.g. 1 -> "001" */
function pad(page: number): string {
  return String(page).padStart(3, "0");
}

/**
 * Run an array of async tasks with bounded concurrency.
 * Calls `onDone` after each task completes so the caller can track progress.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onDone?: () => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
      onDone?.();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Mushaf download / remove
// ---------------------------------------------------------------------------

export async function downloadMushaf(
  code: MushafCode,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const isQcf = QCF_CODES.includes(code);

  // Each page may produce 1 fetch (JSON) or 2 fetches (JSON + font).
  const totalSteps = isQcf ? TOTAL_PAGES * 2 : TOTAL_PAGES;
  let done = 0;

  const report = () => {
    onProgress({ total: totalSteps, done, label: `Downloading mushaf "${code}"` });
  };

  report();

  // Build tasks ----------------------------------------------------------
  const tasks: (() => Promise<void>)[] = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const pageKey = `p${pad(page)}`;

    // JSON data task
    tasks.push(async () => {
      const url = `/mushaf-data/${code}/${pageKey}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const data = await res.json();
      await dbPut("mushaf-pages", `${code}:${pageKey}`, data);
      done++;
      report();
    });

    // Font task (QCF codes only)
    if (isQcf) {
      tasks.push(async () => {
        const fontUrl = getQcfFontUrl(code, page);
        const res = await fetch(fontUrl);
        if (!res.ok) throw new Error(`Failed to fetch font ${fontUrl}: ${res.status}`);
        const blob = await res.arrayBuffer();
        await dbPut("mushaf-fonts", `${code}:${pageKey}`, blob);
        done++;
        report();
      });
    }
  }

  await runWithConcurrency(tasks, 8);

  // Mark as complete
  await dbPut("mushaf-pages", `${code}:complete`, true);
  onProgress({ total: totalSteps, done: totalSteps, label: `Mushaf "${code}" downloaded` });
}

export async function removeMushaf(code: MushafCode): Promise<void> {
  const prefix = `${code}:`;

  const pageKeys = await dbGetAllKeys("mushaf-pages");
  for (const key of pageKeys) {
    if (key.startsWith(prefix)) {
      await dbDelete("mushaf-pages", key);
    }
  }

  const fontKeys = await dbGetAllKeys("mushaf-fonts");
  for (const key of fontKeys) {
    if (key.startsWith(prefix)) {
      await dbDelete("mushaf-fonts", key);
    }
  }
}

// ---------------------------------------------------------------------------
// Translation download / remove
// ---------------------------------------------------------------------------

export async function downloadTranslation(
  translationId: Exclude<TranslationId, "abu-iyaad">,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const apiId = TRANSLATION_API_IDS[translationId];
  let done = 0;

  const report = () => {
    onProgress({
      total: TOTAL_PAGES,
      done,
      label: `Downloading translation "${translationId}"`,
    });
  };

  report();

  const tasks: (() => Promise<void>)[] = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    tasks.push(async () => {
      const entries = await fetchPageTranslations(page, apiId);
      for (const entry of entries) {
        await dbPut("translations", `${translationId}:${entry.verseKey}`, entry.text);
      }
      done++;
      report();
    });
  }

  await runWithConcurrency(tasks, 4);

  // Mark as complete
  await dbPut("translations", `${translationId}:complete`, true);
  onProgress({
    total: TOTAL_PAGES,
    done: TOTAL_PAGES,
    label: `Translation "${translationId}" downloaded`,
  });
}

export async function downloadAbuIyaad(
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  onProgress({ total: 1, done: 0, label: 'Downloading "abu-iyaad" translation' });

  const res = await fetch("/data/abu-iyaad.json");
  if (!res.ok) throw new Error(`Failed to fetch abu-iyaad.json: ${res.status}`);

  const data = (await res.json()) as Record<string, string>;
  const entries = Object.entries(data);

  const total = entries.length || 1;
  let done = 0;

  onProgress({
    total,
    done,
    label: 'Saving "abu-iyaad" translation',
  });

  for (const [verseKey, text] of entries) {
    await dbPut("translations", `abu-iyaad:${verseKey}`, text);
    done++;
    if (done % 150 === 0) {
      onProgress({
        total,
        done,
        label: 'Saving "abu-iyaad" translation',
      });
    }
  }

  await dbPut("translations", "abu-iyaad:complete", true);
  onProgress({
    total,
    done: total,
    label: '"abu-iyaad" translation downloaded',
  });
}

export async function removeTranslation(translationId: TranslationId): Promise<void> {
  const prefix = `${translationId}:`;
  const keys = await dbGetAllKeys("translations");
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      await dbDelete("translations", key);
    }
  }
}
