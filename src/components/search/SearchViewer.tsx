"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Loader2, Search, X } from "lucide-react";
import type { QuranSearchResponse } from "@/lib/search";
import { VerseCard } from "@/components/lemma/VerseCard";
import { usePreferences } from "@/hooks/usePreferences";
import { fetchVersePages } from "@/lib/navigation/maps";
import { isQcfCode, loadQcfFont } from "@/lib/mushaf/fonts";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuranSearchResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [fontsReady, setFontsReady] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  const trimmedInput = input.trim();
  const hasInput = trimmedInput.length > 0;

  // Keep the textbox in sync with back/forward navigations.
  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  // Debounced URL sync. Clearing keeps the user on /search and removes the query.
  useEffect(() => {
    const trimmed = trimmedInput;
    const current = urlQ.trim();
    if (trimmed === current) return;

    const timeoutId = window.setTimeout(() => {
      if (!trimmed) {
        if (current) router.replace("/search");
        return;
      }
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    }, URL_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [router, trimmedInput, urlQ]);

  // Fetch results whenever the URL query changes (already debounced).
  useEffect(() => {
    const q = urlQ.trim();
    setSelectedVerse(null);
    setSelectedWordIndex(null);
    if (!q) {
      setResponse(null);
      setLoading(false);
      setError(null);
      setVisibleCount(BATCH_SIZE);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setFontsReady(false);

    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_RESULTS_LIMIT}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          const msg =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Search is unavailable right now.";
          throw new Error(msg);
        }
        return payload as QuranSearchResponse;
      })
      .then((data) => {
        if (!active) return;
        setResponse(data);
        setVisibleCount(BATCH_SIZE);
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Search is unavailable right now.");
        setResponse(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [urlQ]);

  const handleWordTap = useCallback((verseKey: string, wordIndex: number) => {
    setSelectedVerse(verseKey);
    setSelectedWordIndex(wordIndex >= 0 ? wordIndex : null);
  }, []);

  const allVerseKeys = useMemo(() => {
    return (response?.results ?? []).map((r) => r.verse_key);
  }, [response]);

  const visibleVerseKeys = useMemo(
    () => allVerseKeys.slice(0, visibleCount),
    [allVerseKeys, visibleCount],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= allVerseKeys.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allVerseKeys.length));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [allVerseKeys.length, visibleCount]);

  // Font preloading for currently visible verses (QCF only).
  useEffect(() => {
    let active = true;
    async function loadFonts() {
      if (!isQcfCode(mushafCode)) {
        setFontsReady(true);
        return;
      }
      if (visibleVerseKeys.length === 0) return;

      try {
        const pagesMap = await fetchVersePages(mushafCode);
        const pagesToLoad = new Set<number>();

        for (const verseKey of visibleVerseKeys) {
          const pageLookup = pagesMap[verseKey];
          if (!pageLookup) continue;
          const startPage = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
          const endPage = Array.isArray(pageLookup) ? pageLookup[1] : pageLookup;
          for (let p = startPage; p <= endPage; p++) pagesToLoad.add(p);
        }

        for (const p of Array.from(pagesToLoad)) {
          if (!active) break;
          await loadQcfFont(mushafCode, p);
        }
        if (active) setFontsReady(true);
      } catch {
        if (active) setFontsReady(true);
      }
    }
    setFontsReady(false);
    loadFonts();
    return () => {
      active = false;
    };
  }, [mushafCode, visibleVerseKeys]);

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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (!trimmedInput) return;
                router.replace(`/search?q=${encodeURIComponent(trimmedInput)}`);
              }}
              placeholder="Search Quran…"
              className="w-full rounded-lg bg-[var(--color-surface)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-muted)]/20 focus:ring-[var(--color-accent)]/40"
              autoComplete="off"
              inputMode="search"
            />
            {loading ? (
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--color-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : hasInput ? (
              <button
                type="button"
                onClick={() => setInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-[var(--color-muted)] active:bg-black/5"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>

        {urlQ.trim().length > 0 && !loading && response && (
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
            <span className="truncate">
              {response.total_matches} match{response.total_matches === 1 ? "" : "es"} for{" "}
              <span className="font-medium text-[var(--color-text)]">{response.query}</span>
            </span>
            <span className="tabular-nums">
              showing {Math.min(visibleCount, allVerseKeys.length)} /{" "}
              {response.limited_to}
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && urlQ.trim().length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
            <p>Type to search the Quran.</p>
            <p className="mt-1 text-xs opacity-70">Clearing the search returns you home.</p>
          </div>
        )}

        {!error && urlQ.trim().length > 0 && !loading && allVerseKeys.length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
            <p>
              No matches for{" "}
              <span className="font-medium text-[var(--color-text)]">{urlQ.trim()}</span>.
            </p>
          </div>
        )}

        {visibleVerseKeys.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-8 pb-6">
            {visibleVerseKeys.map((verseKey) => (
              <VerseCard
                key={verseKey}
                verseKey={verseKey}
                highlightedWords={[]}
                mushafCode={mushafCode}
                fontReady={fontsReady}
                onWordTap={handleWordTap}
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
        )}
      </main>

      <ReaderBottomNav
        showModeToggle={false}
        onDownloadsClick={() => setDownloadsOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <WordTapSheets
        selectedVerse={selectedVerse}
        selectedWordIndex={selectedWordIndex}
        translationIds={prefs.translationIds}
        mushafCode={mushafCode}
        onClose={() => {
          setSelectedVerse(null);
          setSelectedWordIndex(null);
        }}
      />

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DownloadManager open={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
    </div>
  );
}
