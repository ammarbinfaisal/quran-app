import type { MushafCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";
import {
  decodeMushafPagePayloadFromProto,
  parseMushafPagePayload,
} from "@/lib/mushaf/proto";
import {
  DEFAULT_FONT_CACHE_BUDGET_BYTES,
  DEFAULT_PAGE_PAYLOAD_CACHE_LIMIT,
} from "@/mushaf-engine/constants";
import {
  getPageFontFamily,
  getPageFontUrl,
  getPagePayloadUrls,
} from "@/mushaf-engine/assets";
import { LruSet } from "@/mushaf-engine/utils/lru";

type ResourceStatus = "idle" | "loading" | "ready" | "error";

export type PagePayloadSnapshot =
  | { status: "idle" | "loading" }
  | { status: "ready"; payload: MushafPagePayload | null }
  | { status: "error" };

export type FontSnapshot =
  | { status: "idle" | "loading"; family: string }
  | { status: "ready"; family: string }
  | { status: "error"; family: string };

type Listener = () => void;

type PageRecord = {
  status: ResourceStatus;
  payload: MushafPagePayload | null;
  controller: AbortController | null;
  snapshot: PagePayloadSnapshot;
};

type FontRecord = {
  status: ResourceStatus;
  family: string;
  fontFace: FontFace | null;
  bytes: number;
  controller: AbortController | null;
  snapshot: FontSnapshot;
};

const PAGE_IDLE: PagePayloadSnapshot = { status: "idle" };
const PAGE_LOADING: PagePayloadSnapshot = { status: "loading" };
const PAGE_ERROR: PagePayloadSnapshot = { status: "error" };

async function loadPayloadFromProto(url: string, signal: AbortSignal) {
  const res = await fetch(url, { cache: "force-cache", signal });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) return null;
  return decodeMushafPagePayloadFromProto(bytes);
}

async function loadPayloadFromJson(url: string, signal: AbortSignal) {
  const res = await fetch(url, { cache: "force-cache", signal });
  if (!res.ok) return null;
  const json = (await res.json()) as unknown;
  return parseMushafPagePayload(json);
}

export class MushafRuntime {
  private readonly pageListeners = new Map<number, Set<Listener>>();
  private readonly fontListeners = new Map<number, Set<Listener>>();

  private readonly pages = new Map<number, PageRecord>();
  private readonly fonts = new Map<number, FontRecord>();

  private readonly pageLru = new LruSet<number>();
  private readonly fontLru = new LruSet<number>();

  private pinnedPages = new Set<number>();
  private fontBytesInCache = 0;

  constructor(
    private readonly mushafCode: MushafCode,
    private readonly opts?: {
      pagePayloadCacheLimit?: number;
      fontCacheBudgetBytes?: number;
    }
  ) {}

  getDebugSnapshot() {
    return {
      mushafCode: this.mushafCode,
      pinnedPages: this.pinnedPages.size,
      pagePayloadCache: this.pages.size,
      fontCacheEntries: this.fonts.size,
      fontCacheBytes: this.fontBytesInCache,
      fontCacheBudgetBytes:
        this.opts?.fontCacheBudgetBytes ?? DEFAULT_FONT_CACHE_BUDGET_BYTES,
    };
  }

  setPinnedPages(pages: readonly number[]) {
    this.pinnedPages = new Set(pages);
    this.cancelUnpinnedInFlight();
    this.evictPagePayloadsIfNeeded();
    void this.evictFontsIfNeeded();
  }

  subscribePagePayload(page: number, cb: Listener): () => void {
    const set = this.pageListeners.get(page) ?? new Set<Listener>();
    set.add(cb);
    this.pageListeners.set(page, set);
    return () => {
      const current = this.pageListeners.get(page);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.pageListeners.delete(page);
    };
  }

  subscribeFont(page: number, cb: Listener): () => void {
    const set = this.fontListeners.get(page) ?? new Set<Listener>();
    set.add(cb);
    this.fontListeners.set(page, set);
    return () => {
      const current = this.fontListeners.get(page);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.fontListeners.delete(page);
    };
  }

  getPagePayloadSnapshot(page: number): PagePayloadSnapshot {
    let record = this.pages.get(page);
    if (!record) {
      record = { status: "idle", payload: null, controller: null, snapshot: PAGE_IDLE };
      this.pages.set(page, record);
    }
    return record.snapshot;
  }

  getFontSnapshot(page: number): FontSnapshot {
    const family = getPageFontFamily(this.mushafCode, page);
    let record = this.fonts.get(page);
    if (!record) {
      record = {
        status: "idle",
        family,
        fontFace: null,
        bytes: 0,
        controller: null,
        snapshot: { status: "idle", family },
      };
      this.fonts.set(page, record);
    }
    return record.snapshot;
  }

  ensurePagePayload(page: number) {
    this.pageLru.touch(page);
    const current = this.pages.get(page);
    if (current?.status === "ready" || current?.status === "loading") return;

    const controller = new AbortController();
    const record: PageRecord =
      current ??
      ({
        status: "idle",
        payload: null,
        controller: null,
        snapshot: PAGE_IDLE,
      } satisfies PageRecord);

    record.status = "loading";
    record.payload = null;
    record.controller = controller;
    record.snapshot = PAGE_LOADING;
    this.pages.set(page, record);
    this.emitPage(page);

    void (async () => {
      const { protoUrl, jsonUrl } = getPagePayloadUrls(this.mushafCode, page);
      const payload =
        (await loadPayloadFromProto(protoUrl, controller.signal)) ??
        (await loadPayloadFromJson(jsonUrl, controller.signal));
      if (controller.signal.aborted) return;

      const next = this.pages.get(page);
      if (!next) return;
      next.controller = null;
      next.status = "ready";
      next.payload = payload;
      next.snapshot = { status: "ready", payload };
      this.emitPage(page);
      this.evictPagePayloadsIfNeeded();
    })().catch(() => {
      if (controller.signal.aborted) return;
      const next = this.pages.get(page);
      if (!next) return;
      next.controller = null;
      next.status = "error";
      next.snapshot = PAGE_ERROR;
      this.emitPage(page);
    });
  }

  ensureFont(page: number) {
    if (typeof document === "undefined") return;
    this.fontLru.touch(page);

    const family = getPageFontFamily(this.mushafCode, page);
    const current =
      this.fonts.get(page) ??
      ({
        status: "idle",
        family,
        fontFace: null,
        bytes: 0,
        controller: null,
        snapshot: { status: "idle", family },
      } satisfies FontRecord);

    this.fonts.set(page, current);
    if (current.status === "ready" || current.status === "loading") return;

    const url = getPageFontUrl(this.mushafCode, page);
    if (!url) {
      current.status = "error";
      current.controller = null;
      current.fontFace = null;
      current.bytes = 0;
      current.snapshot = { status: "error", family };
      this.emitFont(page);
      return;
    }

    const controller = new AbortController();
    current.status = "loading";
    current.controller = controller;
    current.snapshot = { status: "loading", family };
    this.emitFont(page);

    void (async () => {
      const res = await fetch(url, { cache: "force-cache", signal: controller.signal });
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      if (controller.signal.aborted) return;

      const bytes = buffer.byteLength;
      const fontFace = new FontFace(family, buffer, { display: "block" });
      await fontFace.load();
      if (controller.signal.aborted) return;

      document.fonts.add(fontFace);

      const next = this.fonts.get(page);
      if (!next) return;
      next.controller = null;
      next.status = "ready";
      next.fontFace = fontFace;
      next.bytes = bytes;
      next.snapshot = { status: "ready", family };
      this.fontBytesInCache += bytes;
      this.emitFont(page);
      await this.evictFontsIfNeeded();
    })().catch(() => {
      if (controller.signal.aborted) return;
      const next = this.fonts.get(page);
      if (!next) return;
      next.controller = null;
      next.status = "error";
      next.snapshot = { status: "error", family };
      this.emitFont(page);
    });
  }

  prefetch(pages: readonly number[]) {
    for (const page of pages) {
      this.ensurePagePayload(page);
      this.ensureFont(page);
    }
  }

  dispose() {
    for (const record of this.pages.values()) record.controller?.abort();
    for (const record of this.fonts.values()) {
      record.controller?.abort();
      if (record.fontFace && typeof document !== "undefined") {
        try {
          document.fonts.delete(record.fontFace);
        } catch {
          // ignore
        }
      }
    }
    this.pages.clear();
    this.fonts.clear();
    this.pageListeners.clear();
    this.fontListeners.clear();
    this.pageLru.clear();
    this.fontLru.clear();
    this.pinnedPages.clear();
    this.fontBytesInCache = 0;
  }

  private emitPage(page: number) {
    const set = this.pageListeners.get(page);
    if (!set) return;
    for (const cb of set) cb();
  }

  private emitFont(page: number) {
    const set = this.fontListeners.get(page);
    if (!set) return;
    for (const cb of set) cb();
  }

  private evictPagePayloadsIfNeeded() {
    const limit = this.opts?.pagePayloadCacheLimit ?? DEFAULT_PAGE_PAYLOAD_CACHE_LIMIT;
    if (this.pages.size <= limit) return;

    for (const page of this.pageLru.keysOldestFirst()) {
      if (this.pages.size <= limit) return;
      if (this.pinnedPages.has(page)) continue;
      const record = this.pages.get(page);
      if (!record) continue;
      if (record.status === "loading") continue;
      this.pages.delete(page);
      this.pageLru.delete(page);
    }
  }

  private async evictFontsIfNeeded() {
    const budget = this.opts?.fontCacheBudgetBytes ?? DEFAULT_FONT_CACHE_BUDGET_BYTES;
    if (this.fontBytesInCache <= budget) return;

    for (const page of this.fontLru.keysOldestFirst()) {
      if (this.fontBytesInCache <= budget) return;
      if (this.pinnedPages.has(page)) continue;
      const record = this.fonts.get(page);
      if (!record) continue;
      if (record.status !== "ready") continue;

      if (record.fontFace && typeof document !== "undefined") {
        try {
          document.fonts.delete(record.fontFace);
        } catch {
          // ignore
        }
      }

      this.fontBytesInCache = Math.max(0, this.fontBytesInCache - record.bytes);
      this.fonts.delete(page);
      this.fontLru.delete(page);
      this.emitFont(page);
    }
  }

  private cancelUnpinnedInFlight() {
    for (const [page, record] of this.pages.entries()) {
      if (this.pinnedPages.has(page)) continue;
      if (record.status !== "loading") continue;
      record.controller?.abort();
      this.pages.delete(page);
      this.pageLru.delete(page);
      this.emitPage(page);
    }

    for (const [page, record] of this.fonts.entries()) {
      if (this.pinnedPages.has(page)) continue;
      if (record.status !== "loading") continue;
      record.controller?.abort();
      this.fonts.delete(page);
      this.fontLru.delete(page);
      this.emitFont(page);
    }
  }
}

