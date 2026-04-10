import { DATA_USAGE_POLICIES, isLayerEnabled } from "@/lib/dataUsage";
import { getEffectiveDataMode } from "./networkQuality";
import { loadAbuIyaadData } from "@/lib/translations/abu-iyaad";
import { loadTranslation } from "@/lib/translations/loader";
import { loadMushafPage } from "@/lib/mushaf/loader";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import { pageToJuz } from "@/lib/navigation/maps";
import { dbGet, dbPut } from "@/lib/offline/storage";
import type { DataUsageMode, MushafCode, TranslationId } from "@/lib/types";
import { getChapters } from "@/lib/chapters";

type MorphologyChunk = Record<string, MorphologyEntry[]>;

interface MorphologyEntry {
  features?: {
    lem?: string;
  };
}

interface QueueTask {
  key: string;
  run: () => Promise<void>;
}

export interface ReaderPrefetchRequest {
  mushafCode: MushafCode;
  dataUsageMode: DataUsageMode;
  translationIds: TranslationId[];
  scopeType: "p" | "s" | "j";
  focusPage: number | null;
  scopePages: number[];
}

const PREFETCH_CONCURRENCY = 2;
const completedTaskKeys = new Set<string>();
const queuedTaskKeys = new Set<string>();
const taskQueue: QueueTask[] = [];
const morphologyChunkCache = new Map<string, Promise<MorphologyChunk>>();
let activeTaskCount = 0;

function uniquePages(pages: number[]): number[] {
  return Array.from(new Set(pages.filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b);
}

function expandAround(page: number, radius: number): number[] {
  const pages: number[] = [];
  for (let offset = -radius; offset <= radius; offset++) {
    const next = page + offset;
    if (next >= 1 && next <= 604) pages.push(next);
  }
  return pages;
}

function scheduleTask(key: string, run: () => Promise<void>) {
  if (completedTaskKeys.has(key) || queuedTaskKeys.has(key)) return;
  queuedTaskKeys.add(key);
  taskQueue.push({ key, run });
  pumpQueue();
}

function pumpQueue() {
  while (activeTaskCount < PREFETCH_CONCURRENCY && taskQueue.length > 0) {
    const task = taskQueue.shift();
    if (!task) return;

    activeTaskCount++;
    const startTask = async () => {
      try {
        await task.run();
        completedTaskKeys.add(task.key);
      } catch {
        completedTaskKeys.delete(task.key);
      } finally {
        queuedTaskKeys.delete(task.key);
        activeTaskCount--;
        setTimeout(pumpQueue, 16);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        void startTask();
      }, { timeout: 1200 });
    } else {
      setTimeout(() => {
        void startTask();
      }, 0);
    }
  }
}

function collectTargetPages(request: ReaderPrefetchRequest, effectiveMode: DataUsageMode): {
  assetPages: number[];
  translationPages: number[];
  detailPages: number[];
} {
  const policy = DATA_USAGE_POLICIES[effectiveMode];
  const focusPage = request.focusPage ?? request.scopePages[0] ?? null;
  if (!focusPage) {
    return { assetPages: [], translationPages: [], detailPages: [] };
  }

  const localWindow = uniquePages(
    request.scopeType === "p"
      ? expandAround(focusPage, policy.pageModeLookaheadRadius)
      : expandAround(focusPage, policy.adjacentPageRadius),
  );

  const assetPages =
    policy.completeScopeAssets && request.scopeType !== "p"
      ? uniquePages(request.scopePages)
      : localWindow;

  const translationPages =
    policy.prefetchTranslations === "scope" && request.scopeType !== "p"
      ? uniquePages(request.scopePages)
      : policy.prefetchTranslations === "adjacent"
        ? localWindow
        : [];

  const detailPages = policy.prefetchMorphology
    ? uniquePages(expandAround(focusPage, policy.lemmaPageRadius))
    : [];

  const bridgePages: number[] = [];
  if (
    isLayerEnabled(effectiveMode, "L4_bridge") &&
    request.scopeType !== "p" &&
    request.scopePages.length > 0
  ) {
    const first = request.scopePages[0];
    const last = request.scopePages[request.scopePages.length - 1];
    if (focusPage >= last - 1 && last < 604) bridgePages.push(last + 1);
    if (focusPage <= first + 1 && first > 1) bridgePages.push(first - 1);
  }

  const modeSwitchPages: number[] = [];
  if (isLayerEnabled(effectiveMode, "L5_mode_switch") && request.scopeType === "p" && focusPage != null) {
    const chapter = getChapters().find((c) => c.pages[0] <= focusPage && focusPage <= c.pages[1]);
    if (chapter) {
      const alreadyQueued = new Set([...assetPages, ...localWindow]);
      for (let p = chapter.pages[0]; p <= chapter.pages[1]; p++) {
        if (!alreadyQueued.has(p)) modeSwitchPages.push(p);
      }
    }
  }

  return {
    assetPages: uniquePages([...assetPages, ...bridgePages, ...modeSwitchPages]),
    translationPages: uniquePages([...translationPages, ...bridgePages, ...modeSwitchPages]),
    detailPages,
  };
}

function padJuz(juz: number) {
  return String(juz).padStart(2, "0");
}

async function loadMorphologyChunkForPage(page: number): Promise<MorphologyChunk> {
  const juz = pageToJuz(page);
  const chunkKey = `juz-${padJuz(juz)}`;
  const existing = morphologyChunkCache.get(chunkKey);
  if (existing) return existing;

  const request = (async () => {
    const cached = await dbGet<MorphologyChunk | undefined>("morphology", chunkKey).catch(() => undefined);
    if (cached) return cached;

    const res = await fetch(`/data/morphology/${chunkKey}.json`);
    if (!res.ok) {
      throw new Error(`Failed to prefetch morphology ${chunkKey}: ${res.status}`);
    }

    const data = (await res.json()) as MorphologyChunk;
    dbPut("morphology", chunkKey, data).catch(() => {});
    return data;
  })().catch((error) => {
    morphologyChunkCache.delete(chunkKey);
    throw error;
  });

  morphologyChunkCache.set(chunkKey, request);
  return request;
}

function extractVerseKeysFromPage(pageData: Awaited<ReturnType<typeof loadMushafPage>>): string[] {
  const verseKeys = new Set<string>();
  for (const line of pageData.lines) {
    for (const word of line.words) {
      if (word.verseKey) {
        verseKeys.add(word.verseKey);
      }
    }
  }
  return Array.from(verseKeys);
}

async function prefetchPageAssets(mushafCode: MushafCode, page: number): Promise<void> {
  await loadMushafPage(mushafCode, page);
  if (isQcfCode(mushafCode)) {
    await loadQcfFont(mushafCode, page);
  }
}

async function prefetchPageTranslations(
  mushafCode: MushafCode,
  page: number,
  translationIds: TranslationId[],
): Promise<void> {
  if (translationIds.length === 0) return;

  const pageData = await loadMushafPage(mushafCode, page);
  const verseKeys = extractVerseKeysFromPage(pageData);
  if (verseKeys.length === 0) return;

  if (translationIds.includes("abu-iyaad")) {
    await loadAbuIyaadData();
  }

  await Promise.all(
    translationIds.map(async (translationId) => {
      await Promise.all(
        verseKeys.map((verseKey) => loadTranslation(verseKey, translationId)),
      );
    }),
  );
}

function collectLemmaKeys(
  chunk: MorphologyChunk,
  verseKeys: string[],
  maxLemmaFilesPerPage: number,
): string[] {
  const lemmaKeys = new Set<string>();

  for (const verseKey of verseKeys) {
    for (let wordIndex = 1; wordIndex <= 40; wordIndex++) {
      const entry = chunk[`${verseKey}:${wordIndex}`];
      if (!entry) continue;
      for (const segment of entry) {
        const lemma = segment.features?.lem?.replace(/[{}]/g, "");
        if (lemma) {
          lemmaKeys.add(lemma);
          if (lemmaKeys.size >= maxLemmaFilesPerPage) {
            return Array.from(lemmaKeys);
          }
        }
      }
    }
  }

  return Array.from(lemmaKeys);
}

async function prefetchLemmaFile(lemmaKey: string): Promise<void> {
  const cached = await dbGet("lemmas", lemmaKey).catch(() => undefined);
  if (cached) return;

  const res = await fetch(`/data/lemmas/${encodeURIComponent(lemmaKey)}.json`);
  if (!res.ok) {
    throw new Error(`Failed to prefetch lemma ${lemmaKey}: ${res.status}`);
  }

  const data = await res.json();
  await dbPut("lemmas", lemmaKey, data).catch(() => {});
}

async function prefetchPageDetails(
  mushafCode: MushafCode,
  page: number,
  maxLemmaFilesPerPage: number,
): Promise<void> {
  const pageData = await loadMushafPage(mushafCode, page);
  const verseKeys = extractVerseKeysFromPage(pageData);
  if (verseKeys.length === 0) return;

  const chunk = await loadMorphologyChunkForPage(page);
  const lemmaKeys = collectLemmaKeys(chunk, verseKeys, maxLemmaFilesPerPage);
  await Promise.all(lemmaKeys.map((lemmaKey) => prefetchLemmaFile(lemmaKey)));
}

export function scheduleReaderPrefetch(request: ReaderPrefetchRequest): void {
  const effectiveMode = getEffectiveDataMode(request.dataUsageMode);
  if (effectiveMode === "low") return;

  const policy = DATA_USAGE_POLICIES[effectiveMode];
  const { assetPages, translationPages, detailPages } = collectTargetPages(request, effectiveMode);

  for (const page of assetPages) {
    scheduleTask(`page-assets:${request.mushafCode}:${page}`, () =>
      prefetchPageAssets(request.mushafCode, page),
    );
  }

  for (const page of translationPages) {
    const translationKey = request.translationIds.slice().sort().join(",");
    scheduleTask(`page-translations:${request.mushafCode}:${translationKey}:${page}`, () =>
      prefetchPageTranslations(request.mushafCode, page, request.translationIds),
    );
  }

  if (policy.prefetchMorphology) {
    for (const page of detailPages) {
      scheduleTask(`page-details:${request.mushafCode}:${page}`, () =>
        prefetchPageDetails(request.mushafCode, page, policy.maxLemmaFilesPerPage),
      );
    }
  }
}

export function prefetchNavigationTarget(
  mushafCode: MushafCode,
  dataUsageMode: DataUsageMode,
  translationIds: TranslationId[],
  page: number,
): void {
  scheduleReaderPrefetch({
    mushafCode,
    dataUsageMode,
    translationIds,
    scopeType: "p",
    focusPage: page,
    scopePages: [page],
  });
}

export function resetReaderPrefetchState(): void {
  completedTaskKeys.clear();
  queuedTaskKeys.clear();
  taskQueue.length = 0;
  morphologyChunkCache.clear();
}
