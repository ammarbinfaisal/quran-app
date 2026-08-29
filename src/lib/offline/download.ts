import { TOTAL_PAGES } from "@/lib/constants";
import { fetchPageTranslations } from "@/lib/api";
import {
  type MushafCode,
  type TranslationId,
  type DownloadProgress,
  type AyahReciterId,
  QCF_CODES,
  TRANSLATION_API_IDS,
} from "@/lib/types";
import { dbPut, dbPutMany, dbDelete, dbGetAllKeys, dbClear } from "@/lib/offline/storage";
import { SEARCH_INDEX_KEY, SEARCH_INDEX_STORE, SEARCH_INDEX_URL } from "@/lib/search/constants";
import { clearSearchIndexMemoryCache } from "@/lib/search/client";
import { getChapters } from "@/lib/chapters";
import { AYAH_RECITERS } from "@/lib/ayahRecitation";
import { getQcfFontUrl } from "@/lib/mushaf/fonts";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import { ensureCurrentMushafAssetRevision } from "@/lib/offline/mushafRevision";
import { compactToContent, parseTranslationSegments, segmentsToContent, type TranslationSegment, type TranslationContent, type CompactSeg } from "@/lib/footnotes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const V2 = "v2:";

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
  await ensureCurrentMushafAssetRevision();

  const isQcf = QCF_CODES.includes(code);

  // Each page may produce 1 fetch (JSON) or 2 fetches (JSON + font), plus one
  // fetch for the search index so search keeps working offline.
  const totalSteps = (isQcf ? TOTAL_PAGES * 2 : TOTAL_PAGES) + 1;
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
      const url = `/mushaf-data/${code}/${pageKey}.json?rev=${MUSHAF_ASSET_REV}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const data = await res.json();
      await dbPut("mushaf-pages", `${code}:${MUSHAF_ASSET_REV}:${pageKey}`, data);
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
        await dbPut("mushaf-fonts", `${code}:${MUSHAF_ASSET_REV}:${pageKey}`, blob);
        done++;
        report();
      });
    }
  }

  // Search index task (single file, see scripts/generate-search-index.ts)
  tasks.push(async () => {
    const res = await fetch(SEARCH_INDEX_URL);
    if (!res.ok) throw new Error(`Failed to fetch ${SEARCH_INDEX_URL}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    await dbPut(SEARCH_INDEX_STORE, SEARCH_INDEX_KEY, buffer);
    done++;
    report();
  });

  await runWithConcurrency(tasks, 8);

  // Mark as complete
  await dbPut("mushaf-pages", `${code}:${MUSHAF_ASSET_REV}:complete`, true);
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

  await dbDelete(SEARCH_INDEX_STORE, SEARCH_INDEX_KEY);
  clearSearchIndexMemoryCache();
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
      // Prefer static precomputed translation assets; fall back to API if missing.
      const url = `/data/translations/${translationId}/p${pad(page)}.json`;
      let wrote = false;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as Record<string, TranslationSegment[]>;
          const toStore: Array<[string, TranslationContent]> = [];
          for (const [verseKey, segments] of Object.entries(data)) {
            toStore.push([`${V2}${translationId}:${verseKey}`, segmentsToContent(segments)]);
          }
          await dbPutMany("translations", toStore);
          wrote = true;
        }
      } catch {
        // fall through
      }

      if (!wrote) {
        const entries = await fetchPageTranslations(page, apiId);
        const toStore: Array<[string, TranslationContent]> = [];
        for (const entry of entries) {
          const rawHtml = entry.text ?? "";
          const segments = parseTranslationSegments(rawHtml, translationId);
          toStore.push([`${V2}${translationId}:${entry.verseKey}`, segmentsToContent(segments)]);
        }
        await dbPutMany("translations", toStore);
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

  const data = (await res.json()) as Record<string, CompactSeg[]>;
  const entries = Object.entries(data);

  const total = entries.length || 1;
  let done = 0;

  onProgress({
    total,
    done,
    label: 'Saving "abu-iyaad" translation',
  });

  const batch: Array<[string, TranslationContent]> = [];
  const flush = async () => {
    if (batch.length === 0) return;
    await dbPutMany("translations", batch);
    batch.length = 0;
  };

  for (const [verseKey, segs] of entries) {
    batch.push([`${V2}abu-iyaad:${verseKey}`, compactToContent(segs)]);
    done++;
    if (batch.length >= 400) {
      await flush();
      onProgress({ total, done, label: 'Saving "abu-iyaad" translation' });
    } else if (done % 150 === 0) {
      onProgress({ total, done, label: 'Saving "abu-iyaad" translation' });
    }
  }
  await flush();

  await dbPut("translations", "abu-iyaad:complete", true);
  onProgress({
    total,
    done: total,
    label: '"abu-iyaad" translation downloaded',
  });
}

export async function removeTranslation(translationId: TranslationId): Promise<void> {
  const prefix = `${translationId}:`;
  const v2Prefix = `${V2}${translationId}:`;
  const keys = await dbGetAllKeys("translations");
  for (const key of keys) {
    if (key.startsWith(prefix) || key.startsWith(v2Prefix)) {
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

// ---------------------------------------------------------------------------
// Recitation audio download / remove
// ---------------------------------------------------------------------------

/**
 * Build the full list of verse keys (1:1, 1:2, ... 114:6) using chapter data.
 */
function allVerseKeys(): string[] {
  const chapters = getChapters();
  const keys: string[] = [];
  for (const ch of chapters) {
    for (let a = 1; a <= ch.versesCount; a++) {
      keys.push(`${ch.id}:${a}`);
    }
  }
  return keys;
}

export async function downloadRecitation(
  reciterId: AyahReciterId,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const reciter = AYAH_RECITERS[reciterId];
  if (!reciter) throw new Error(`Unknown reciter: ${reciterId}`);

  const verses = allVerseKeys();
  const total = verses.length;
  let done = 0;

  const report = () => {
    onProgress({
      total,
      done,
      label: `Downloading ${reciter.label} audio`,
    });
  };

  report();

  const tasks: (() => Promise<void>)[] = [];

  for (const vk of verses) {
    tasks.push(async () => {
      const [surahStr, ayahStr] = vk.split(":");
      const surah = Number.parseInt(surahStr, 10);
      const ayah = Number.parseInt(ayahStr, 10);
      const fileName = `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;
      const url = `${reciter.cdnPath}/${fileName}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const buffer = await res.arrayBuffer();
      await dbPut("recitation-audio", `${reciterId}:${vk}`, buffer);

      done++;
      if (done % 50 === 0 || done === total) report();
    });
  }

  await runWithConcurrency(tasks, 6);

  await dbPut("recitation-audio", `${reciterId}:complete`, true);
  onProgress({
    total,
    done: total,
    label: `${reciter.label} audio downloaded`,
  });
}

export async function removeRecitation(reciterId: AyahReciterId): Promise<void> {
  const prefix = `${reciterId}:`;
  const keys = await dbGetAllKeys("recitation-audio");
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      await dbDelete("recitation-audio", key);
    }
  }
}
