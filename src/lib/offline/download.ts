import { TOTAL_PAGES } from "@/lib/constants";
import { fetchPageTranslations } from "@/lib/api";
import {
  type MushafCode,
  type TranslationId,
  type DownloadProgress,
  QCF_CODES,
  TRANSLATION_API_IDS,
} from "@/lib/types";
import { dbPut, dbDelete, dbGetAllKeys, dbClear } from "@/lib/offline/storage";
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

// ---------------------------------------------------------------------------
// Morphology download / remove (30 juz-based chunks)
// ---------------------------------------------------------------------------

export async function downloadMorphology(
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const totalChunks = 30;
  let done = 0;

  const report = () => {
    onProgress({ total: totalChunks, done, label: "Downloading morphology data" });
  };

  report();

  const tasks: (() => Promise<void>)[] = [];

  for (let juz = 1; juz <= 30; juz++) {
    const juzStr = String(juz).padStart(2, "0");
    tasks.push(async () => {
      const url = `/data/morphology/juz-${juzStr}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const data = await res.json();
      // Store the entire juz chunk as one entry for efficient loading
      await dbPut("morphology", `juz-${juzStr}`, data);
      done++;
      report();
    });
  }

  await runWithConcurrency(tasks, 6);

  await dbPut("morphology", "complete", true);
  onProgress({ total: totalChunks, done: totalChunks, label: "Morphology data downloaded" });
}

export async function removeMorphology(): Promise<void> {
  await dbClear("morphology");
}

// ---------------------------------------------------------------------------
// Lemma download / remove (fetch manifest then all files)
// ---------------------------------------------------------------------------

export async function downloadLemmas(
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  onProgress({ total: 1, done: 0, label: "Fetching lemma index" });

  const indexRes = await fetch("/data/lemmas/index.json");
  if (!indexRes.ok) throw new Error(`Failed to fetch lemma index: ${indexRes.status}`);
  const filenames: string[] = await indexRes.json();

  const total = filenames.length;
  let done = 0;

  const report = () => {
    onProgress({ total, done, label: "Downloading lemma data" });
  };

  report();

  const tasks: (() => Promise<void>)[] = [];

  for (const filename of filenames) {
    tasks.push(async () => {
      const url = `/data/lemmas/${encodeURIComponent(filename)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const data = await res.json();
      // Key is the filename without .json extension
      const key = filename.replace(/\.json$/, "");
      await dbPut("lemmas", key, data);
      done++;
      if (done % 50 === 0 || done === total) report();
    });
  }

  await runWithConcurrency(tasks, 8);

  await dbPut("lemmas", "complete", true);
  onProgress({ total, done: total, label: "Lemma data downloaded" });
}

export async function removeLemmas(): Promise<void> {
  await dbClear("lemmas");
}
