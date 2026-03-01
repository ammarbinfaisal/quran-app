import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";

export default function DocsPage() {
  return (
    <>
      <JsonLd
        id="docs-jsonld"
        data={createWebPageJsonLd({
          path: "/docs",
          title: "Guide",
          description: "How to use the Quran app.",
        })}
      />
      <main className="h-full w-full overflow-y-auto">
        <div className="mx-auto max-w-xl px-4 py-6 pb-12">
          <header className="mb-6 flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-[var(--color-muted)] active:opacity-70"
            >
              ← Home
            </Link>
            <h1 className="text-lg font-semibold tracking-tight">Guide</h1>
          </header>

          <div className="space-y-8 text-sm text-[var(--color-text)]">

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Reading Modes
              </h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Mushaf (Swipe)</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Page-by-page view. Swipe left/right to turn pages. Tap the center to show controls.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Verse-by-Verse</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Read with translations verse-by-verse. Switch between Surah, Juz, or Page view using the toggle in the bottom bar.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Scroll</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Continuously scroll through pages. Switch between Surah, Juz, or Page view using the toggle in the bottom bar.
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Mushaf URLs
              </h2>
              <div className="space-y-3">
                <p className="text-[var(--color-muted)]">
                  Share links that open a specific mushaf regardless of your settings:
                </p>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3 font-mono text-xs">
                  <div className="mb-1 text-[var(--color-accent)]">/p/&lt;page&gt;</div>
                  <div className="text-[var(--color-muted)]">Madina V2 mushaf, page number</div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3 font-mono text-xs">
                  <div className="mb-1 text-[var(--color-accent)]">/i/&lt;page&gt;</div>
                  <div className="text-[var(--color-muted)]">Indopak Nastaleeq mushaf, page number</div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Word & Ayah Interaction
              </h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Tap an ayah marker (۝)</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Opens the translation sheet for that verse.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Tap a word</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Opens the morphology sheet showing the word{"'"}s grammatical analysis, lemma, and root. Tap the lemma or root to explore all Quranic occurrences.
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Settings
              </h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Mushaf</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Switch between Madina V2 and Indopak Nastaleeq. When you switch, the app navigates to the corresponding page in the new mushaf.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Theme</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Choose between Light, Dark, and Classic themes.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Font Scale</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Adjust the mushaf text size from 1 (smallest) to 10 (largest).
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                  <div className="font-medium">Translations</div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Select which translations to show in verse-by-verse and scroll modes.
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Offline Reading
              </h2>
              <div className="rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-surface)] px-4 py-3">
                <div className="font-medium">Download for Offline Use</div>
                <div className="mt-1 text-[var(--color-muted)]">
                  Open the Downloads panel from the reader bottom bar (cloud icon). Download mushafs and translations to read without an internet connection. Both Madina V2 and Indopak mushafs are available.
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </>
  );
}
