"use client";

import { useState } from "react";
import { getChapters } from "@/lib/chapters";
import type { Chapter } from "@/lib/types";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { usePageNavigation } from "@/hooks/usePageNavigation";
import { useAbuIyaadSurahs } from "@/hooks/useAbuIyaadSurahs";
import { TOTAL_PAGES } from "@/lib/constants";

type TabId = "surah" | "juz" | "page";

const chapters = getChapters();

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={classNames(
        "min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
        selected
          ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
          : "bg-[var(--color-bg)] text-[var(--color-text)] ring-1 ring-[var(--color-muted)]/20 hover:bg-[var(--color-surface)]",
      )}
    >
      {children}
    </button>
  );
}

function SurahRow({
  ch,
  translation,
  onClick,
}: {
  ch: Chapter;
  translation: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "min-h-11 w-full rounded-lg px-3 py-2 text-left outline-none transition",
        "bg-[var(--color-surface)] ring-1 ring-[var(--color-muted)]/20",
        "hover:bg-[color-mix(in_srgb,var(--color-surface)_85%,var(--color-bg))]",
        "active:opacity-80",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="tabular-nums text-[var(--color-muted)]">{ch.id}</span>
            <span className="font-semibold text-[var(--color-text)] truncate">{ch.nameSimple}</span>
            {translation && (
              <span className="text-xs text-[var(--color-muted)] truncate">{translation}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
            Pages {ch.pages[0]}–{ch.pages[1]} · {ch.versesCount} verses
          </div>
        </div>
        <span
          className="shrink-0 leading-none text-[var(--color-text)]"
          style={{ fontFamily: "surahnames", fontSize: "1.8rem" }}
          translate="no"
        >
          {String(ch.id).padStart(3, "0")}
        </span>
      </div>
    </button>
  );
}

function ListButton({
  title,
  subtitle,
  onClick,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "min-h-11 w-full rounded-lg px-3 py-2 text-left outline-none transition",
        "bg-[var(--color-surface)] ring-1 ring-[var(--color-muted)]/20",
        "hover:bg-[color-mix(in_srgb,var(--color-surface)_85%,var(--color-bg))]",
        "active:opacity-80",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[var(--color-text)]">
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function PageTab({ onGoToPage }: { onGoToPage: (page: number) => void }) {
  const [value, setValue] = useState("");

  function handleGo() {
    const n = parseInt(value, 10);
    if (n >= 1 && n <= TOTAL_PAGES) {
      onGoToPage(n);
    }
  }

  return (
    <div className="px-4 pb-4 pt-3 space-y-3">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={TOTAL_PAGES}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGo(); }}
          placeholder={`1 – ${TOTAL_PAGES}`}
          className="min-w-0 flex-1 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-muted)]/20 focus:ring-[var(--color-accent)]/40 tabular-nums"
        />
        <button
          type="button"
          onClick={handleGo}
          disabled={!value || parseInt(value, 10) < 1 || parseInt(value, 10) > TOTAL_PAGES}
          className={classNames(
            "rounded-lg px-4 py-2 text-sm font-semibold transition",
            "bg-[var(--color-accent)] text-[var(--color-bg)]",
            "disabled:opacity-40",
          )}
        >
          Go
        </button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Enter a page number between 1 and {TOTAL_PAGES}.
      </p>
    </div>
  );
}

export function QuickNavigation() {
  const { goToSurah, goToJuz, goToPage } = usePageNavigation();
  const [tab, setTab] = useState<TabId>("surah");
  const surahNames = useAbuIyaadSurahs();

  return (
    <section className="flex flex-col">
      <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Navigate
      </div>

      <div className="px-4">
        <div
          role="tablist"
          aria-label="Navigation tabs"
          className="grid grid-cols-3 gap-2"
        >
          <TabButton selected={tab === "surah"} onClick={() => setTab("surah")}>
            Surah
          </TabButton>
          <TabButton selected={tab === "juz"} onClick={() => setTab("juz")}>
            Juz
          </TabButton>
          <TabButton selected={tab === "page"} onClick={() => setTab("page")}>
            Page
          </TabButton>
        </div>
      </div>

      {tab === "page" ? (
        <PageTab onGoToPage={goToPage} />
      ) : tab === "surah" ? (
        <div className="px-4 pb-4 pt-3">
          <ul className="space-y-2">
            {chapters.map((ch) => (
              <li key={ch.id}>
                <SurahRow
                  ch={ch}
                  translation={surahNames?.[String(ch.id)]}
                  onClick={() => goToSurah(ch.id, ch.pages[0])}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-3">
          <ul className="space-y-2">
            {JUZ_PAGE_RANGES.map((j) => (
              <li key={j.juz}>
                <ListButton
                  title={<span className="tabular-nums">Juz {j.juz}</span>}
                  subtitle={`Pages ${j.pages[0]}–${j.pages[1]}`}
                  onClick={() => goToJuz(j.juz, j.pages[0])}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
