"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { SITE_NAME } from "@/lib/seo";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { usePageNavigation } from "@/hooks/usePageNavigation";
import { QuickNavigation } from "@/components/home/QuickNavigation";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { ModeSettingToggle } from "@/components/navigation/ModeSettingToggle";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import NavigationPicker from "@/components/nav/NavigationPicker";
import { useMountEffect } from "@/hooks/useMountEffect";
import { prefetchHomeEntry } from "@/lib/prefetch/readerPrefetch";
import { getPreferences } from "@/lib/preferences";

const RECENTS_LIMIT = 5;

export function HomePageClient() {
  const { history, refresh } = useReadingHistory();
  const { goToPage } = usePageNavigation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navPickerOpen, setNavPickerOpen] = useState(false);

  // Apply theme and font scale via preferences listener
  useApplyPreferences();

  useMountEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === "/") {
        refresh();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  const continueEntry = useMemo(() => {
    if (history.length === 0) return null;
    return history.reduce((latest, entry) =>
      entry.timestamp > latest.timestamp ? entry : latest,
    );
  }, [history]);

  const recentEntries = useMemo(() => history.slice(0, RECENTS_LIMIT), [history]);

  useMountEffect(() => {
    const prefs = getPreferences();
    prefetchHomeEntry(
      prefs.mushafCode,
      prefs.dataUsageMode,
      prefs.translationIds,
      continueEntry?.pageNumber ?? null,
      recentEntries.map((e) => e.pageNumber),
    );
  });

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="mx-auto flex h-full max-w-xl flex-col lg:max-w-4xl">
        <header className="flex items-center justify-between px-4 pb-2 pt-5">
          <h1 className="text-2xl font-semibold tracking-tight capitalize">{SITE_NAME}</h1>
        </header>

        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              if (continueEntry) {
                goToPage(continueEntry.pageNumber, undefined, continueEntry.verseKey);
              } else {
                goToPage(1);
              }
            }}
            className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-4 text-left text-[var(--color-bg)] active:opacity-80"
          >
            <div className="text-base font-semibold">Continue reading</div>
            <div className="mt-1 text-xs opacity-90">
              {continueEntry
                ? `${continueEntry.chapterName} · page ${continueEntry.pageNumber}`
                : "Start at page 1"}
            </div>
          </button>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20">
          <div className="mb-5">
            <HomeSearchBar />
          </div>
          <QuickNavigation />

          <section className="mt-5 flex flex-col pb-4">
            <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Recent
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                No reading history yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-muted)]/20">
                {recentEntries.map((entry) => (
                  <li key={`${entry.chapterId}:${entry.timestamp}`}>
                    <button
                      type="button"
                      onClick={() =>
                        goToPage(entry.pageNumber, undefined, entry.verseKey)
                      }
                      className="flex w-full items-center justify-between px-4 py-3 min-h-12 text-left active:opacity-70"
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
          </section>
        </div>
        <ReaderBottomNav
          showModeToggle={false}
          centerLabel={{
            icon: <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />,
            text: "Go to…",
            ariaLabel: "Open navigation",
            onClick: () => setNavPickerOpen(true),
          }}
          centerExtra={<ModeSettingToggle />}
          onSettingsClick={() => setSettingsOpen(true)}
        />
        <NavigationPicker
          open={navPickerOpen}
          onClose={() => setNavPickerOpen(false)}
          onNavigate={(nextPage, verseKey) => {
            goToPage(nextPage, undefined, verseKey ?? undefined);
            setNavPickerOpen(false);
          }}
        />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </main>
  );
}
