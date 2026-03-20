"use client";

import { usePreferences } from "@/hooks/usePreferences";

export function InlineVerseNotesToggle() {
  const { prefs, setPref } = usePreferences();

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Verse Notes
      </h3>
      <button
        type="button"
        onClick={() => setPref("inlineVerseNotes", !prefs.inlineVerseNotes)}
        aria-pressed={prefs.inlineVerseNotes}
        className="flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors"
        style={{
          borderColor: prefs.inlineVerseNotes ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
          backgroundColor: prefs.inlineVerseNotes ? "var(--color-surface)" : "var(--color-bg)",
        }}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)]">
            Show notes inline
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
            Show notes under the verse instead of in a sheet.
          </div>
        </div>
        <div
          className="ml-3 h-4 w-8 rounded-full border transition"
          style={{
            borderColor: prefs.inlineVerseNotes ? "var(--color-accent)" : "rgba(0,0,0,0.12)",
            backgroundColor: prefs.inlineVerseNotes ? "var(--color-accent)" : "var(--color-bg)",
          }}
          aria-hidden="true"
        />
      </button>
    </section>
  );
}
