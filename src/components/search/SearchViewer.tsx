"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Home, Search, X } from "lucide-react";
import type { QuranSearchResponse } from "@/lib/search/types";
import { runSearch } from "@/lib/search/client";
import type { MushafWord as MushafWordType } from "@/lib/types";
import { VerseCard } from "@/components/lemma/VerseCard";
import { usePreferences } from "@/hooks/usePreferences";
import { fetchVersePages, type VersePageMap } from "@/lib/navigation/maps";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { shareUrl } from "@/lib/share";
import { WordTapSheets } from "@/components/ayah/WordTapSheets";
import type { WordTapTarget, OnWordTap } from "@/lib/wordTap";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { MushafCode } from "@/lib/types";
import { useMushafPage } from "@/hooks/useMushafPage";
import { DATA_USAGE_POLICIES } from "@/lib/dataUsage";
import { SEARCH_MIN_QUERY_LETTERS } from "@/lib/search/constants";
import { countSearchLetters } from "@/lib/search/normalize";

/** Idle time after the last keystroke before the query is committed to the URL (and searched). */
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULTS_LIMIT = 50;

function searchPath(query: string): string {
  return query ? `/search?q=${encodeURIComponent(query)}` : "/search";
}

function currentUrlQuery(): string {
  return (new URL(window.location.href).searchParams.get("q") ?? "").trim();
}

/**
 * Commits a typed query to the URL, which is what drives the search. While
 * typing, queries under the letter minimum clear the URL instead; Enter
 * (`force`) searches whatever was typed. Pure address-bar update: Next syncs
 * useSearchParams with the native History API, so unlike router.replace this
 * costs no RSC round trip per keystroke burst.
 */
function commitSearchQuery(raw: string, force = false) {
  const trimmed = raw.trim();
  const next = force || countSearchLetters(trimmed) >= SEARCH_MIN_QUERY_LETTERS ? trimmed : "";
  if (next === currentUrlQuery()) return;
  window.history.replaceState(null, "", searchPath(next));
}

export function SearchViewer() {
  const searchParams = useSearchParams();
  const urlQ = (searchParams.get("q") ?? "").trim();
  const { prefs } = usePreferences();
  const mushafCode = prefs.mushafCode;

  const [input, setInput] = useState(urlQ);
  const [syncedUrlQ, setSyncedUrlQ] = useState(urlQ);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTap, setSelectedTap] = useState<WordTapTarget | null>(null);

  if (syncedUrlQ !== urlQ) {
    setSyncedUrlQ(urlQ);
    // Adopt external URL changes (back/forward, shared link) only; our own
    // debounced commit must not clobber what is being typed, e.g. the trailing
    // space of "و " on the way to "و ما".
    if (urlQ !== input.trim()) setInput(urlQ);
  }

  const hasInput = input.trim().length > 0;
  const inputLetters = countSearchLetters(input);
  const debounceRef = useRef<number>(0);

  const scheduleCommit = useCallback((raw: string) => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commitSearchQuery(raw), SEARCH_DEBOUNCE_MS);
  }, []);

  const commitNow = useCallback((raw: string, force = false) => {
    window.clearTimeout(debounceRef.current);
    commitSearchQuery(raw, force);
  }, []);

  useMountEffect(() => () => window.clearTimeout(debounceRef.current));

  const handleWordTap = useCallback((target: WordTapTarget) => {
    setSelectedTap(target);
  }, []);

  const handleShare = useCallback(() => {
    void shareUrl(window.location.href);
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
                scheduleCommit(newValue);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                commitNow(input, true);
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
                  commitNow("");
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
        {!urlQ ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
            <p>
              {inputLetters > 0 && inputLetters < SEARCH_MIN_QUERY_LETTERS
                ? `Type at least ${SEARCH_MIN_QUERY_LETTERS} letters, or press Enter to search now.`
                : "Type to search the Quran."}
            </p>
            <p className="mt-1 text-xs opacity-70">
              Prefixes may be written apart: <span dir="rtl">“و ما”</span> also finds{" "}
              <span dir="rtl">“وما”</span>.
            </p>
          </div>
        ) : (
          <SearchResultsPanel
            key={`search:${urlQ}:${mushafCode}`}
            query={urlQ}
            mushafCode={mushafCode}
            onWordTap={handleWordTap}
          />
        )}
      </main>

      <ReaderBottomNav
        showModeToggle={false}
        onSettingsClick={() => setSettingsOpen(true)}
        showShare
        onShareClick={handleShare}
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
    </div>
  );
}

/** A group of search-result verses on the same mushaf page. */
interface SearchPageGroup {
  page: number;
  verseKeys: string[];
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
  const { prefs } = usePreferences();
  const batchSize = DATA_USAGE_POLICIES[prefs.dataUsageMode].occurrenceBatchSize;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuranSearchResponse | null>(null);
  const [versePages, setVersePages] = useState<VersePageMap | null>(null);
  const [pagesToShow, setPagesToShow] = useState(batchSize);

  useMountEffect(() => {
    const controller = new AbortController();

    runSearch(query, SEARCH_RESULTS_LIMIT, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setResponse(data);
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

  // Fetch verse-to-page mapping
  useMountEffect(() => {
    let active = true;
    fetchVersePages(mushafCode)
      .then((map) => { if (active) setVersePages(map); })
      .catch(() => {});
    return () => { active = false; };
  });

  // Group search results by mushaf page
  const pageGroups = useMemo<SearchPageGroup[] | null>(() => {
    if (!response || !versePages) return null;
    const allVerseKeys = response.results.map((r) => r.verse_key);

    const pages = new Map<number, string[]>();
    const pageOrder: number[] = [];

    for (const verseKey of allVerseKeys) {
      const lookup = versePages[verseKey];
      if (!lookup) continue;
      const page = Array.isArray(lookup) ? lookup[0] : lookup;
      if (!pages.has(page)) {
        pages.set(page, []);
        pageOrder.push(page);
      }
      pages.get(page)!.push(verseKey);
    }

    // Keep search result order (don't sort by page)
    return pageOrder.map((page) => ({ page, verseKeys: pages.get(page)! }));
  }, [response, versePages]);

  const totalPages = pageGroups?.length ?? 0;

  // Infinite scroll sentinel
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPagesToShow((prev) => Math.min(prev + batchSize, totalPages));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [batchSize, totalPages]);

  useMountEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  });

  const isWaiting = loading || !versePages;
  const allVerseKeys = response?.results?.map((r) => r.verse_key) ?? [];

  return (
    <>
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
            {allVerseKeys.length} / {response.limited_to}
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
      ) : pageGroups && pageGroups.length > 0 ? (
        <div className="mx-auto max-w-3xl pb-6 lg:max-w-5xl">
          {pageGroups.slice(0, pagesToShow).map((group) => (
            <SearchPageBatch
              key={group.page}
              pageNum={group.page}
              mushafCode={mushafCode}
              verseKeys={group.verseKeys}
              onWordTap={onWordTap}
            />
          ))}

          {pagesToShow < totalPages && (
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

function SearchPageBatch({
  pageNum,
  mushafCode,
  verseKeys,
  onWordTap,
}: {
  pageNum: number;
  mushafCode: MushafCode;
  verseKeys: string[];
  onWordTap: OnWordTap;
}) {
  const { pageData, fontReady, showFontSkeleton } = useMushafPage(mushafCode, pageNum);

  const verseWords = useMemo(() => {
    if (!pageData) return null;
    const verseKeySet = new Set(verseKeys);
    const blocks: Record<string, MushafWordType[]> = {};

    for (const line of pageData.lines) {
      for (const word of line.words) {
        if (!word.verseKey || !verseKeySet.has(word.verseKey)) continue;
        if (!blocks[word.verseKey]) blocks[word.verseKey] = [];
        blocks[word.verseKey].push(word);
      }
    }

    return blocks;
  }, [pageData, verseKeys]);

  if (!pageData) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        {verseKeys.slice(0, 2).map((vk) => (
          <div key={vk} className="h-28 w-full rounded-xl bg-[var(--color-muted)]/10" />
        ))}
      </div>
    );
  }

  return (
    <>
      {verseKeys.map((vk) => (
        <VerseCard
          key={vk}
          verseKey={vk}
          words={verseWords?.[vk]}
          mushafCode={mushafCode}
          pageNum={pageNum}
          fontReady={fontReady}
          showFontSkeleton={showFontSkeleton}
          onWordTap={onWordTap}
          showVerseLink
        />
      ))}
    </>
  );
}
