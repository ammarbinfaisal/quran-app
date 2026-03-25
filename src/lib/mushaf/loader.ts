import type { MushafCode, MushafPagePayload } from "@/lib/types";
import { TOTAL_PAGES } from "@/lib/constants";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import { dbGet, dbPut } from "@/lib/offline/storage";
import { ensureCurrentMushafAssetRevision } from "@/lib/offline/mushafRevision";

// ---------------------------------------------------------------------------
// Page number padding
// ---------------------------------------------------------------------------

function padPage(pageNum: number): string {
  return String(pageNum).padStart(3, "0");
}

function cacheKeyOf(code: MushafCode, pageNum: number) {
  return `${code}:${MUSHAF_ASSET_REV}:p${padPage(pageNum)}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function runPool(tasks: Array<() => Promise<void>>, concurrency: number) {
  let i = 0;
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (i < tasks.length) {
      const idx = i++;
      try {
        await tasks[idx]();
      } catch {
        // ignore preload failures
      }
    }
  });
  await Promise.all(workers);
}


// ✅ Sync memory cache (for instant reads during render)
const memCache = new Map<string, MushafPagePayload>();

// ✅ Deduplicate concurrent loads
const inflight = new Map<string, Promise<MushafPagePayload>>();

export function clearMushafPageMemoryCache(): void {
  memCache.clear();
  inflight.clear();
}

export function getCachedMushafPage(code: MushafCode, pageNum: number) {
  return memCache.get(cacheKeyOf(code, pageNum)) ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadMushafPage(
  code: MushafCode,
  pageNum: number,
): Promise<MushafPagePayload> {
  const key = cacheKeyOf(code, pageNum);

  // 0) Sync memory hit
  const mem = memCache.get(key);
  if (mem) return mem;

  // 1) Inflight dedupe
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    await ensureCurrentMushafAssetRevision();

    // 2) IndexedDB
    try {
      const cached = await dbGet<MushafPagePayload>("mushaf-pages", key);
      if (cached) {
        memCache.set(key, cached);
        return cached;
      }
    } catch {
      // ignore
    }

    // 3) Network
    const url = `/mushaf-data/${code}/p${padPage(pageNum)}.json?rev=${MUSHAF_ASSET_REV}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load mushaf page ${code} p${pageNum}: ${res.status}`);
    }
    const payload: MushafPagePayload = await res.json();

    // write-through to memory immediately (important)
    memCache.set(key, payload);

    // Cache in IndexedDB for offline use
    try {
      await dbPut("mushaf-pages", key, payload);
    } catch {
      // ignore
    }

    return payload;
  })();

  inflight.set(key, p);

  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}


/**
 * Preload adjacent page data into cache, in a controlled pool.
 * radius=10 means up to 10 pages on each side (max 20 requests), but
 * most will be instant due to memCache/IDB.
 */
export function preloadAdjacentPages(
  code: MushafCode,
  currentPage: number,
  radius = 10,
  concurrency = 4,
): void {
  const start = clamp(currentPage - radius, 1, TOTAL_PAGES);
  const end = clamp(currentPage + radius, 1, TOTAL_PAGES);

  const pages: number[] = [];
  for (let p = start; p <= end; p++) {
    if (p === currentPage) continue;
    pages.push(p);
  }

  // Optional: prioritize closer pages first
  pages.sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));

  const tasks = pages.map((p) => async () => {
    // Fast skip if already in memory
    if (getCachedMushafPage(code, p)) return;
    await loadMushafPage(code, p);
  });

  // fire-and-forget (don’t await in UI thread)
  void runPool(tasks, concurrency);
}
