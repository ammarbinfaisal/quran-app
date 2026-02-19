"use client";

import { useMemo } from "react";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { usePageNavigation } from "@/hooks/usePageNavigation";
import { getPreferences } from "@/lib/preferences";

export default function HomePage() {
  const { history, refresh } = useReadingHistory();
  const { goToPage } = usePageNavigation();

  const continueEntry = history[0] ?? null;
  const prefs = useMemo(() => getPreferences(), []);

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="mx-auto flex h-full max-w-xl flex-col">
        <header className="flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Quran</h1>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md px-3 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Refresh
          </button>
        </header>

        <div className="px-4">
          <button
            type="button"
            onClick={() => {
              if (continueEntry) {
                goToPage(
                  continueEntry.pageNumber,
                  prefs.mushafCode,
                  continueEntry.verseKey,
                );
              } else {
                goToPage(1, prefs.mushafCode);
              }
            }}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-left text-[var(--color-bg)]"
          >
            <div className="text-sm font-semibold">Continue reading</div>
            <div className="mt-0.5 text-xs opacity-90">
              {continueEntry
                ? `${continueEntry.chapterName} · page ${continueEntry.pageNumber}`
                : "Start at page 1"}
            </div>
          </button>
        </div>

        <section className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Recent
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                No reading history yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-muted)]/20">
                {history.map((entry) => (
                  <li key={entry.chapterId}>
                    <button
                      type="button"
                      onClick={() =>
                        goToPage(entry.pageNumber, prefs.mushafCode, entry.verseKey)
                      }
                      className="flex w-full items-center justify-between px-4 py-4 text-left active:opacity-70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                          {entry.chapterName}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                          Page {entry.pageNumber} · Verse {entry.verseKey}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-muted)]">
                        Open
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
