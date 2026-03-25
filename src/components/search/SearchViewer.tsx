"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Search, X } from "lucide-react";
import type { QuranSearchResponse } from "@/lib/search";
import { VerseCard } from "@/components/lemma/VerseCard";
import { usePreferences } from "@/hooks/usePreferences";
import { fetchVersePages } from "@/lib/navigation/maps";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import type { WordTapTarget } from "@/lib/wordTap";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { MushafCode } from "@/lib/types";

const URL_SYNC_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LIMIT = 50;
const BATCH_SIZE = 10;

export function SearchViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const { prefs } = usePreferences();
  const mushafCode = prefs.mushafCode;

  const [input, setInput] = useState(urlQ);
  const [syncedUrlQ, setSyncedUrlQ] = useState(urlQ);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);

  if (syncedUrlQ !== urlQ) {
    setSyncedUrlQ(urlQ);
    setInput(urlQ);
  }

  const trimmedInput = input.trim();
  const hasInput = trimmedInput.length > 0;
  const urlSyncTimerRef = useRef<number>(0);

  const handleWordTap = useCallback((target: WordTapTarget) => {
    setSelectedTap(target);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]/10"
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
          </Link>

          <label className="relative block flex-1">
            <span className="sr-only">Search Quran</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={input}
              onChange={(e) => {
                const newValue = e.target.value;
                setInput(newValue);
                const trimmed = newValue.trim();
                const current = urlQ.trim();
                if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
                if (trimmed === current) return;
                urlSyncTimerRef.current = window.setTimeout(() => {
                  if (!trimmed) {
                    if (current) router.replace("/search");
                    return;
                  }
                  router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
                }, URL_SYNC_DEBOUNCE_MS);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (!trimmedInput) return;
                if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
                router.replace(`/search?q=${encodeURIComponent(trimmedInput)}`);
              }}
              placeholder="Search Quran…"
              className="w-full rounded-lg bg-[var(--color-surface)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-muted)]/20 focus:ring-[var(--color-accent)]/40"
              autoComplete="off"
              inputMode="search"
            />
            {hasInput ? (
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
                  if (urlQ.trim()) {
                    router.replace("/search");
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-[var(--color-muted)] active:bg-black/5"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28">
        {urlQ.trim().length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
            <p>Type to search the Quran.</p>
            <p className="mt-1 text-xs opacity-70">Clearing the search returns you home.</p>
          </div>
        ) : (
          <SearchResultsPanel
            key={`search:${urlQ}:${mushafCode}`}
            query={urlQ.trim()}
            mushafCode={mushafCode}
            onWordTap={handleWordTap}
          />
        )}
      </main>

      <ReaderBottomNav
        showModeToggle={false}
        onDownloadsClick={() => setDownloadsOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <WordTapSheets
        selectedTap={selectedTap}
        translationIds={prefs.translationIds}
        mushafCode={mushafCode}
        onClose={() => {
          setSelectedTap(null);
        }}
      />

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DownloadManager open={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
    </div>
  );
}

function SearchResultsPanel({
  query,
  mushafCode,
  onWordTap,
}: {
  query: string;
  mushafCode: MushafCode;
  onWordTap: (target: WordTapTarget) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuranSearchResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [fontsReady, setFontsReady] = useState(!isQcfCode(mushafCode));

  useMountEffect(() => {
    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${SEARCH_RESULTS_LIMIT}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Search is unavailable right now.";
          throw new Error(message);
        }
        return payload as QuranSearchResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResponse(data);
        setVisibleCount(BATCH_SIZE);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Search is unavailable right now.");
        setResponse(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  });

  const allVerseKeys = useMemo(
    () => (response?.results ?? []).map((result) => result.verse_key),
    [response],
  );
  const visibleVerseKeys = useMemo(
    () => allVerseKeys.slice(0, visibleCount),
    [allVerseKeys, visibleCount],
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allVerseKeys.length));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [allVerseKeys.length]);

  useMountEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  });

  const fontLoadKey = `${mushafCode}:${visibleVerseKeys.join(",")}`;
  const isWaiting = loading || (isQcfCode(mushafCode) && !fontsReady && visibleVerseKeys.length > 0);

  return (
    <>
      {visibleVerseKeys.length > 0 && (
        <FontPreloader
          key={fontLoadKey}
          mushafCode={mushafCode}
          verseKeys={visibleVerseKeys}
          onReady={setFontsReady}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && !loading && response && (
        <div className="mb-6 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span className="truncate">
            {response.total_matches} match{response.total_matches === 1 ? "" : "es"} for{" "}
            <span className="font-medium text-[var(--color-text)]">{response.query}</span>
          </span>
          <span className="tabular-nums">
            showing {Math.min(visibleCount, allVerseKeys.length)} / {response.limited_to}
          </span>
        </div>
      )}

      {!error && !loading && allVerseKeys.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
          <p>
            No matches for{" "}
            <span className="font-medium text-[var(--color-text)]">{query}</span>.
          </p>
        </div>
      ) : null}

      {isWaiting ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10" />
          ))}
        </div>
      ) : visibleVerseKeys.length > 0 ? (
        <div className="mx-auto max-w-3xl space-y-8 pb-6">
          {visibleVerseKeys.map((verseKey) => (
            <VerseCard
              key={verseKey}
              verseKey={verseKey}
              highlightedWords={[]}
              mushafCode={mushafCode}
              fontReady={fontsReady}
              onWordTap={onWordTap}
              showVerseLink
            />
          ))}

          {visibleCount < allVerseKeys.length && (
            <div ref={sentinelRef} className="space-y-4">
              <div className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
              <div className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10 animate-pulse" />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function FontPreloader({
  mushafCode,
  verseKeys,
  onReady,
}: {
  mushafCode: MushafCode;
  verseKeys: string[];
  onReady: (ready: boolean) => void;
}) {
  useMountEffect(() => {
    let active = true;

    if (!isQcfCode(mushafCode) || verseKeys.length === 0) {
      onReady(true);
      return;
    }

    onReady(false);

    (async () => {
      try {
        const pagesMap = await fetchVersePages(mushafCode);
        const pagesToLoad = new Set<number>();

        for (const verseKey of verseKeys) {
          const pageLookup = pagesMap[verseKey];
          if (!pageLookup) continue;
          const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
          const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
          for (let page = startPage; page <= endPage; page++) {
            pagesToLoad.add(page);
          }
        }

        for (const page of pagesToLoad) {
          if (!active) return;
          await loadQcfFont(mushafCode, page);
        }

        if (active) {
          onReady(true);
        }
      } catch {
        if (active) {
          onReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  });

  return null;
}
