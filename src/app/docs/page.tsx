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
  Github,
  Library,
  ScrollText,
  Search,
  Play,
} from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";
import { AYAH_RECITER_DISPLAY_NAMES, SUPPORTED_AYAH_RECITERS } from "@/lib/types";
import { DATA_USAGE_MODES, DATA_USAGE_MODE_DETAILS } from "@/lib/dataUsage";
import { DocsMobileNavigation, DocsSidebarNavigation } from "@/components/docs/DocsNavigation";

const SECTION_CARD_CLASS =
  "rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-4 shadow-sm sm:p-5";
const SECTION_CLASS = "mt-8 scroll-mt-24";
const DOCS_SCROLL_ROOT_ID = "docs-scroll-root";

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
    description: "Open Shaykh Abu Iyaad's notes in a sheet when notes exist for that verse.",
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

const DOCS_SECTIONS = [
  { id: "reading-modes", title: "Reading modes" },
  { id: "scope-icons", title: "Scope icons" },
  { id: "ayah-actions", title: "Ayah actions" },
  {
    id: "data-controls",
    title: "Data controls",
    items: [
      { id: "data-usage-modes", title: "Data usage modes" },
      { id: "data-manager-actions", title: "Data manager actions" },
    ],
  },
  { id: "sources-and-attribution", title: "Sources and attribution" },
  { id: "design-choices", title: "Design choices" },
  { id: "ayah-playback", title: "Why these qurra" },
  { id: "ergonomics", title: "Ergonomics" },
] as const;

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Read about the app's reading modes, navigation, sources, and design choices.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Docs",
    description:
      "Read about the app's reading modes, navigation, sources, and design choices.",
    url: "/docs",
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs",
    description:
      "Read about the app's reading modes, navigation, sources, and design choices.",
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
            "Read about the app's reading modes, navigation, sources, and design choices.",
        })}
      />

      <main
        id={DOCS_SCROLL_ROOT_ID}
        className="h-dvh overflow-y-auto overscroll-contain bg-[var(--color-bg)] text-[var(--color-text)]"
        dir="ltr"
      >
        <div className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-5 sm:pb-16 sm:pt-6 lg:px-6">
          <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80"
            >
              <ChevronLeft className="h-4 w-4" />
              Back home
            </Link>
          </div>
          <DocsMobileNavigation sections={[...DOCS_SECTIONS]} scrollRootId={DOCS_SCROLL_ROOT_ID} />

          <div className="lg:grid lg:grid-cols-[16rem,minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[17rem,minmax(0,1fr)] xl:gap-8">
            <DocsSidebarNavigation
              sections={[...DOCS_SECTIONS]}
              scrollRootId={DOCS_SCROLL_ROOT_ID}
            />

            <div className="min-w-0">
              <section className="rounded-3xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-5 shadow-sm sm:px-8 sm:py-8">
                <p className="text-sm font-medium text-[var(--color-accent)]">Documentation</p>
                <h1 className="mt-3 text-balance text-3xl font-semibold sm:text-4xl">
                  How the app works
                </h1>
                <p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-[var(--color-muted)] sm:text-base">
                  The app is built for focused phone reading: compact controls, stable reading anchors,
                  and details moved out of the main surface unless they are needed. These notes explain
                  the main choices in plain language so both regular readers and more detail-oriented
                  users can understand what the settings are doing.
                </p>
              </section>

              <section id="reading-modes" className={SECTION_CLASS}>
                <h2 className="text-balance text-xl font-semibold">Reading modes</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  The mode switch uses icons to save space and stay reachable with one hand. Each mode is
                  meant to keep the reader oriented without asking them to relearn the app.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {READ_MODES.map(({ label, description, Icon }) => (
                    <div
                      key={label}
                      className={SECTION_CARD_CLASS}
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

              <section id="scope-icons" className={SECTION_CLASS}>
                <h2 className="text-balance text-xl font-semibold">Scope icons</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Verse and scroll views can be anchored by surah, juz, or page. These icons show the
                  current scope without adding more text to the bottom bar.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {NAVIGATION_SCOPES.map(({ label, description, Icon }) => (
                    <div
                      key={label}
                      className={SECTION_CARD_CLASS}
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

              <section id="ayah-actions" className={SECTION_CLASS}>
                <h2 className="text-balance text-xl font-semibold">Ayah actions</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Ayah tools stay near the thumb zone and only appear when relevant to the selected verse
                  or word.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {AYAH_ACTIONS.map(({ label, description, Icon }) => (
                    <div
                      key={label}
                      className={`${SECTION_CARD_CLASS} flex gap-4`}
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

              <section id="data-controls" className={SECTION_CLASS}>
                <h2 className="text-balance text-xl font-semibold">Data controls</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Settings keeps these controls short. The details live here instead, in more ordinary
                  language, so you can tell the difference between background downloading and full offline
                  downloads.
                </p>

                <div id="data-usage-modes" className="mt-6 scroll-mt-24">
                  <h3 className="text-balance text-lg font-semibold">Data usage modes</h3>
                  <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    This setting changes how much the app quietly downloads around your current reading
                    position while you continue using it.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {DATA_USAGE_MODES.map((mode) => {
                      const detail = DATA_USAGE_MODE_DETAILS[mode];
                      return (
                        <article
                          key={mode}
                          className={SECTION_CARD_CLASS}
                        >
                          <h4 className="text-sm font-semibold">{detail.label}</h4>
                          <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                            {detail.docsDescription}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div id="data-manager-actions" className="mt-6 scroll-mt-24">
                  <h3 className="text-balance text-lg font-semibold">Data manager actions</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <article className={SECTION_CARD_CLASS}>
                      <h4 className="text-sm font-semibold">Purge cache</h4>
                      <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                        Removes background data the app saved to keep nearby reading faster. It does not
                        remove anything you intentionally downloaded for offline use.
                      </p>
                    </article>
                    <article className={SECTION_CARD_CLASS}>
                      <h4 className="text-sm font-semibold">Remove downloads</h4>
                      <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                        Deletes assets you intentionally downloaded for offline use, including mushaf data,
                        translations, morphology chunks, and lemma data.
                      </p>
                    </article>
                  </div>
                </div>
              </section>

              <section id="sources-and-attribution" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Sources and attribution</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Quran text, page structure, and search are based on Tarteel and related Quran data
                    feeds. Shaykh Abu Iyaad&apos;s translation and notes are linked back to
                    thenoblequran.com, so the source trail remains clear.
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
                    The current ayah-recitation data was taken from{" "}
                    <a
                      href="https://qul.tarteel.ai/"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      qul.tarteel.ai
                    </a>
                    . Additional reciters may be added later if a source fits the same standard and can
                    be integrated cleanly.
                  </p>
                </article>
              </section>

              <section id="design-choices" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Design choices</h2>
                  <div className="mt-3 space-y-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    <p>
                      Tajweed color coding is intentionally absent. The app is not trying to train
                      dependence on color as a substitute for learning the rules directly from the script
                      and the recitation.
                    </p>
                    <p>
                      Reading position is preserved so switching views, leaving the app, or returning later
                      keeps you near the same ayah instead of making you reconstruct your place.
                    </p>
                    <p>
                      Secondary tools live in sheets and drawers so the reading surface can stay calm while
                      still making notes, word study, and downloads easy to reach when needed.
                    </p>
                  </div>
                </article>
              </section>

              <section id="ayah-playback" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Why these qurra for ayah playback</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Qari selection here is a design choice, not a content dump. For ayah playback the aim
                    is dependable recitation for listening, repetition, and following the ayah closely, so
                    the app prefers murattal over more embellished styles.
                  </p>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Murattal, when it is strong, stays closer to itqan (precision): cleaner articulation,
                    steadier pacing, clearer lengths, and stopping points that are easier for the ear to
                    follow. That makes it better suited here for study, revision, and repeated verse
                    playback.
                  </p>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    The list is intentionally small. The goal is not to gather every famous qari, but to
                    keep a purposeful set whose murattal recordings, as available in the current data
                    sources, fit that standard of clarity and measured tajweed.
                  </p>
                  <ul className="mt-4 space-y-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    {SUPPORTED_AYAH_RECITERS.map((id) => (
                      <li key={id} className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 py-3">
                        {AYAH_RECITER_DISPLAY_NAMES[id]}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    These are the three included for now because their murattal recitations best match
                    that purpose in the source data the app currently uses.
                  </p>
                </article>
              </section>

              <section id="ergonomics" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Ergonomics</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Frequent controls stay within thumb reach, especially on phones, because that is where
                    the app is used most. Icons are used where they remain unmistakable, labels appear
                    where ambiguity would slow the reader down, and secondary controls stay in sheets
                    instead of occupying the reading area all the time.
                  </p>
                </article>
              </section>

              <section className="mt-8">
                <a
                  href="https://github.com/ammarbinfaisal/quran-app"
                  target="_blank"
                  rel="noreferrer"
                  className={`${SECTION_CARD_CLASS} flex items-center justify-between gap-3 transition active:scale-[0.98] active:opacity-80`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">GitHub repository</span>
                    <span className="mt-1 block text-pretty text-sm leading-6 text-[var(--color-muted)]">
                      Browse the source, follow changes, or inspect implementation details.
                    </span>
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <Github className="h-5 w-5 text-[var(--color-accent)]" />
                  </span>
                </a>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
