import type { Metadata } from "next";
import Link from "next/link";
import {
  AlignLeft,
  ArrowLeftRight,
  BookMarked,
  BookOpen,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileText,
  Library,
  ScrollText,
  Search,
  Play,
} from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";
import { AYAH_RECITER_DISPLAY_NAMES, SUPPORTED_AYAH_RECITERS } from "@/lib/types";

const READ_MODES = [
  {
    label: "Page mode",
    description: "Mushaf page view with swipe navigation and page-preserving reading position.",
    Icon: BookOpen,
  },
  {
    label: "Verse mode",
    description: "Verse-by-verse reading with translation blocks and optional inline notes.",
    Icon: AlignLeft,
  },
  {
    label: "Scroll mode",
    description: "Continuous scrolling when you want to move through a longer span without page snaps.",
    Icon: ScrollText,
  },
] as const;

const NAVIGATION_SCOPES = [
  {
    label: "Surah",
    description: "Keep navigation bounded to a single surah.",
    Icon: BookMarked,
  },
  {
    label: "Juz",
    description: "Move through the text juz by juz.",
    Icon: Library,
  },
  {
    label: "Page",
    description: "Navigate by mushaf page numbers when that is the most precise anchor.",
    Icon: FileText,
  },
] as const;

const AYAH_ACTIONS = [
  {
    label: "Play",
    description: "Play or pause the selected ayah recitation.",
    Icon: Play,
  },
  {
    label: "Translation",
    description: "Open the ayah sheet with the active translation set.",
    Icon: BookOpen,
  },
  {
    label: "Notes",
    description: "Open Abu Iyaad notes in a sheet when notes exist for that verse.",
    Icon: FileText,
  },
  {
    label: "Root and lemma",
    description: "Open the morphology sheet for the tapped word.",
    Icon: Search,
  },
  {
    label: "Similar passages",
    description: "Open the mutashabihat sheet for related verses.",
    Icon: ArrowLeftRight,
  },
  {
    label: "Copy",
    description: "Copy Arabic, translation, or a combined ayah payload based on your settings.",
    Icon: Copy,
  },
] as const;

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Read about reading modes, icon meanings, data sources, notes attribution, and the design choices behind the Quran app.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Docs",
    description:
      "Read about reading modes, icon meanings, data sources, notes attribution, and the design choices behind the Quran app.",
    url: "/docs",
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs",
    description:
      "Read about reading modes, icon meanings, data sources, notes attribution, and the design choices behind the Quran app.",
  },
};

export default function DocsPage() {
  return (
    <>
      <JsonLd
        id="docs-page-jsonld"
        data={createWebPageJsonLd({
          path: "/docs",
          title: "Docs",
          description:
            "Read about reading modes, icon meanings, data sources, notes attribution, and the design choices behind the Quran app.",
        })}
      />

      <main className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]" dir="ltr">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-6 sm:px-6">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80"
            >
              <ChevronLeft className="h-4 w-4" />
              Back home
            </Link>
          </div>

          <section className="rounded-3xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <p className="text-sm font-medium text-[var(--color-accent)]">Documentation</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold sm:text-4xl">
              How the app is organized and why it behaves this way
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-[var(--color-muted)] sm:text-base">
              This app is designed for focused phone reading first. Controls are kept compact, labels
              appear where they matter, and the main reading anchors stay stable so you can resume
              from where you actually were instead of where the interface decided to reset you.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-balance text-xl font-semibold">Reading modes</h2>
            <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              The main mode switch uses icons instead of wide labels to preserve horizontal space
              while staying reachable with one hand.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {READ_MODES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-4 shadow-sm"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{label}</h3>
                  <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted)]">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-balance text-xl font-semibold">Scope icons</h2>
            <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              Verse and scroll views can be anchored by surah, juz, or page. These icons show how the
              current reading span is grouped without taking over the bottom bar.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {NAVIGATION_SCOPES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-4 shadow-sm"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{label}</h3>
                  <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted)]">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-balance text-xl font-semibold">Ayah actions</h2>
            <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              Ayah tools stay close to the thumb zone and appear only when they are relevant to the
              selected word or verse.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {AYAH_ACTIONS.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="flex gap-4 rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-4 shadow-sm"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <p className="mt-1 text-pretty text-sm leading-6 text-[var(--color-muted)]">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
              <h2 className="text-balance text-xl font-semibold">Sources and attribution</h2>
              <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                Quran text, page structure, and search behavior are grounded in the Tarteel dataset and
                related Quran data feeds used across the app. Abu Iyaad translations and notes are
                linked back to their source so updates or verification can always be checked manually.
              </p>
              <div className="mt-4 space-y-2">
                <a
                  href="https://quran.tarteel.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80"
                >
                  <span>Tarteel</span>
                  <ExternalLink className="h-4 w-4 text-[var(--color-muted)]" />
                </a>
                <a
                  href="https://www.thenoblequran.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80"
                >
                  <span>The Noble Quran</span>
                  <ExternalLink className="h-4 w-4 text-[var(--color-muted)]" />
                </a>
              </div>
              <p className="mt-4 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                The current ayah-recitation datasets were taken from{" "}
                <a
                  href="https://qul.tarteel.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  qul.tarteel.ai
                </a>
                . We plan to add Shaykh Ali al-Hudhaify later, in sha Allah, from another source.
              </p>
            </article>

            <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
              <h2 className="text-balance text-xl font-semibold">Design choices</h2>
              <div className="mt-3 space-y-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                <p>
                  Tajweed color coding is intentionally absent. The aim is to avoid permanent visual
                  training wheels so recognition of the rules can be learned directly instead of being
                  delegated to color.
                </p>
                <p>
                  Reading position is preserved on purpose. When you switch views or return later, the
                  app tries to keep you near the same ayah rather than forcing a fresh start.
                </p>
                <p>
                  More settings will continue to be added for UI customization, ayah highlighting, and
                  reading comfort without crowding the main reading surface.
                </p>
              </div>
            </article>
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
            <h2 className="text-balance text-xl font-semibold">Why these qurra for ayah playback</h2>
            <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              Qari selection is a design choice, not just a content dump. Many reciters balance melody
              and tajweed differently. Some push melody further while cutting into tajweed precision.
              For ayah playback we prioritized murattal, not mujawwad, and chose recitations that keep
              strong itqan in the tajweed rules while still being pleasant to listen to.
            </p>
            <ul className="mt-4 space-y-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              {SUPPORTED_AYAH_RECITERS.map((id) => (
                <li key={id} className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 py-3">
                  {AYAH_RECITER_DISPLAY_NAMES[id]}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              These are the three included for now because they meet that bar in the source datasets we
              currently rely on.
            </p>
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
            <h2 className="text-balance text-xl font-semibold">Ergonomics</h2>
            <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
              Buttons that are used often are intentionally kept close to thumb reach, especially on
              phones. Icons are favored where they stay recognizable, labels appear where ambiguity
              would cost more than the saved space, and secondary controls live in sheets instead of
              permanently occupying the reading area.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
