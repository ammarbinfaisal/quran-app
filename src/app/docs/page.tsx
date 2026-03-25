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
import { DATA_USAGE_MODES, DATA_USAGE_MODE_DETAILS } from "@/lib/dataUsage";
import { DocsMobileNavigation, DocsSidebarNavigation } from "@/components/docs/DocsNavigation";

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
        className="h-dvh overflow-y-auto overscroll-contain bg-[var(--color-bg)] text-[var(--color-text)]"
        dir="ltr"
      >
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition active:scale-[0.98] active:opacity-80"
            >
              <ChevronLeft className="h-4 w-4" />
              Back home
            </Link>
            <DocsMobileNavigation sections={[...DOCS_SECTIONS]} />
          </div>

          <div className="lg:grid lg:grid-cols-[17rem,minmax(0,1fr)] lg:gap-8">
            <DocsSidebarNavigation sections={[...DOCS_SECTIONS]} />

            <div className="min-w-0">
              <section className="rounded-3xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-5 py-6 shadow-sm sm:px-8 sm:py-8">
                <p className="text-sm font-medium text-[var(--color-accent)]">Documentation</p>
                <h1 className="mt-3 text-balance text-3xl font-semibold sm:text-4xl">
                  How the app works
                </h1>
                <p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-[var(--color-muted)] sm:text-base">
                  The app is built for focused phone reading: compact controls, stable reading anchors, and
                  details moved out of the main surface unless they are needed.
                </p>
              </section>

              <section id="reading-modes" className="mt-8 scroll-mt-6">
                <h2 className="text-balance text-xl font-semibold">Reading modes</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  The mode switch uses icons to save space and stay reachable with one hand.
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

              <section id="scope-icons" className="mt-8 scroll-mt-6">
                <h2 className="text-balance text-xl font-semibold">Scope icons</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Verse and scroll views can be anchored by surah, juz, or page. These icons show the
                  current scope without adding more text to the bottom bar.
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

              <section id="ayah-actions" className="mt-8 scroll-mt-6">
                <h2 className="text-balance text-xl font-semibold">Ayah actions</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Ayah tools stay near the thumb zone and only appear when relevant to the selected verse
                  or word.
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

              <section id="data-controls" className="mt-8 scroll-mt-6">
                <h2 className="text-balance text-xl font-semibold">Data controls</h2>
                <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                  Settings keeps these controls short. The details live here instead.
                </p>

                <div id="data-usage-modes" className="mt-6 scroll-mt-6">
                  <h3 className="text-balance text-lg font-semibold">Data usage modes</h3>
                  <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    This controls how aggressively the app prefetches in the background.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {DATA_USAGE_MODES.map((mode) => {
                      const detail = DATA_USAGE_MODE_DETAILS[mode];
                      return (
                        <article
                          key={mode}
                          className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm"
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

                <div id="data-manager-actions" className="mt-6 scroll-mt-6">
                  <h3 className="text-balance text-lg font-semibold">Data manager actions</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                      <h4 className="text-sm font-semibold">Purge cache</h4>
                      <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                        Removes temporary warmed data that can be rebuilt as you keep reading. It does not
                        remove things you explicitly downloaded for offline use.
                      </p>
                    </article>
                    <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                      <h4 className="text-sm font-semibold">Remove downloads</h4>
                      <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                        Deletes assets you intentionally downloaded for offline use, including mushaf data,
                        translations, morphology chunks, and lemma data.
                      </p>
                    </article>
                  </div>
                </div>
              </section>

              <section id="sources-and-attribution" className="mt-8 scroll-mt-6">
                <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                  <h2 className="text-balance text-xl font-semibold">Sources and attribution</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Quran text, page structure, and search are based on Tarteel and related Quran data
                    feeds. Shaykh Abu Iyaad&apos;s translation and notes are attributed back to
                    thenoblequran.com.
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
                    . We may add Shaykh Ali al-Hudhaify later, in sha Allah, from another source.
                  </p>
                </article>
              </section>

              <section id="design-choices" className="mt-8 scroll-mt-6">
                <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                  <h2 className="text-balance text-xl font-semibold">Design choices</h2>
                  <div className="mt-3 space-y-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    <p>
                      Tajweed color coding is intentionally absent so rule recognition is not outsourced to
                      color.
                    </p>
                    <p>
                      Reading position is preserved so switching views or returning later keeps you near the
                      same ayah.
                    </p>
                    <p>
                      More settings can be added over time without crowding the main reading surface.
                    </p>
                  </div>
                </article>
              </section>

              <section id="ayah-playback" className="mt-8 scroll-mt-6">
                <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                  <h2 className="text-balance text-xl font-semibold">Why these qurra for ayah playback</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Qari selection here is a design choice, not a content dump. For ayah playback we
                    prioritized murattal over mujawwad and favored recitations with clear tajweed and
                    measured delivery.
                  </p>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    That also means mujawwad is not treated here as a neutral upgrade in beauty or emotion.
                    We regard it as an introduced performance layer, not the baseline style to normalize in
                    an ayah player, even for these same reciters.
                  </p>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Their inclusion should not be read as an endorsement of every style associated with
                    them. What is included here is their murattal recitation from the datasets currently
                    available to the app.
                  </p>
                  <ul className="mt-4 space-y-2 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    {SUPPORTED_AYAH_RECITERS.map((id) => (
                      <li key={id} className="rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-bg)] px-4 py-3">
                        {AYAH_RECITER_DISPLAY_NAMES[id]}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    These are the three included for now because they meet that bar in the source datasets
                    we currently rely on.
                  </p>
                </article>
              </section>

              <section id="ergonomics" className="mt-8 scroll-mt-6">
                <article className="rounded-2xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-5 shadow-sm">
                  <h2 className="text-balance text-xl font-semibold">Ergonomics</h2>
                  <p className="mt-3 text-pretty text-sm leading-7 text-[var(--color-muted)]">
                    Frequent controls stay within thumb reach, especially on phones. Icons are used where
                    they stay clear, labels appear where needed, and secondary controls live in sheets
                    instead of occupying the reading area full time.
                  </p>
                </article>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
