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
    description: "Open the mutashabihat (similar passages) sheet for related verses.",
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
                  and secondary details kept out of the way until they are needed. This page explains
                  the main settings and design choices in plain language.
                </p>
              </section>

              <section id="reading-modes" className={SECTION_CLASS}>
                <h2 className="text-balance text-xl font-semibold">Reading modes</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  The mode switch uses icons to save space and stay reachable with one hand. Each mode is
                  meant to keep your place without making the app feel different every time you switch.
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
                  Verse and scroll views can be anchored by surah, juz&apos; (part), or page. These icons
                  show the current scope without taking extra space in the bottom bar.
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
                  Ayah tools stay near the thumb zone and only appear when they are relevant to the
                  selected verse or word.
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
                  This section explains the difference between background downloads and full offline
                  downloads.
                </p>

                <div id="data-usage-modes" className="mt-6 scroll-mt-24">
                  <h3 className="text-balance text-lg font-semibold">Data usage modes</h3>
                  <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    This setting controls how much the app preloads around your current reading position
                    while you keep using it.
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
                    Quran text, page structure, and search come from Tarteel and related Quran data
                    feeds. Shaykh Abu Iyaad&apos;s translation and notes are attributed to The Noble
                    Quran.
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
                    . More reciters may be added later if the source quality is strong and the data can
                    be integrated cleanly.
                  </p>
                </article>
              </section>

              <section id="design-choices" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Design choices</h2>
                  <div className="mt-3 space-y-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    <p>
                      Tajwid (recitation rules) color coding is intentionally absent. Some readers do
                      learn the rules and use color only as a reminder, but repeated reliance on color can
                      still train recognition around the cue instead of around the rule in the script
                      itself, such as nun sakinah (a nun without a vowel) or mim sakinah (a mim without a
                      vowel).
                    </p>
                    <p>
                      The aim is for that recognition to develop directly from the written text and the
                      recitation.
                    </p>
                    <p>
                      Reading position stays anchored, so switching views, leaving the app, or returning
                      later keeps you near the same ayah.
                    </p>
                    <p>
                      Secondary tools live in sheets and drawers so the reading surface stays calm.
                    </p>
                  </div>
                </article>
              </section>

              <section id="ergonomics" className={SECTION_CLASS}>
                <article className={SECTION_CARD_CLASS}>
                  <h2 className="text-balance text-xl font-semibold">Ergonomics</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Frequent controls stay within thumb reach because the app is used mostly on phones.
                    Icons are used where they are obvious, labels appear where they prevent ambiguity, and
                    secondary controls move into sheets instead of crowding the reading area.
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
