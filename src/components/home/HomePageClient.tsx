"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { usePageNavigation } from "@/hooks/usePageNavigation";
import { QuickNavigation } from "@/components/home/QuickNavigation";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { ReaderBottomNav } from "@/components/navigation/ReaderBottomNav";
import { ModeSettingToggle } from "@/components/navigation/ModeSettingToggle";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { DownloadManager } from "@/components/offline/DownloadManager";
import NavigationPicker from "@/components/nav/NavigationPicker";

const RECENTS_LIMIT = 5;

export function HomePageClient() {
  const { history } = useReadingHistory();
  const { goToPage } = usePageNavigation();
  const { prefs } = usePreferences();
  const { applyTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [navPickerOpen, setNavPickerOpen] = useState(false);

  useEffect(() => {
    applyTheme(prefs.theme);
    document.documentElement.style.setProperty("--mushaf-font-scale", String(prefs.fontScale));
  }, [applyTheme, prefs.theme, prefs.fontScale]);

  const continueEntry = useMemo(() => {
    if (history.length === 0) return null;
    return history.reduce((latest, entry) =>
      entry.timestamp > latest.timestamp ? entry : latest,
    );
  }, [history]);

  const recentEntries = useMemo(() => history.slice(0, RECENTS_LIMIT), [history]);

  return (
    <main className="h-full w-full overflow-hidden">
      <div className="mx-auto flex h-full max-w-xl flex-col">
        <header className="flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Quran</h1>
        </header>

        <div className="px-4">
          <button
            type="button"
            onClick={() => {
              if (continueEntry) {
                goToPage(continueEntry.pageNumber, undefined, continueEntry.verseKey);
              } else {
                goToPage(1);
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
                      className="flex w-full items-center justify-between px-4 py-3 min-h-12 text-left active:scale-[0.99] active:opacity-80 transition"
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
          onDownloadsClick={() => setDownloadsOpen(true)}
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
        <DownloadManager open={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
      </div>
    </main>
  );
}
