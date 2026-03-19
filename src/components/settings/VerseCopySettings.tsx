"use client";

import { usePreferences } from "@/hooks/usePreferences";
import {
  TRANSLATION_DISPLAY_NAMES,
  SUPPORTED_TRANSLATION_IDS,
  type CopyVerseContentMode,
  type TranslationId,
} from "@/lib/types";

const COPY_MODES: Array<{ value: CopyVerseContentMode; label: string; description: string }> = [
  {
    value: "arabic",
    label: "Arabic only",
    description: "Copy just the Arabic verse text.",
  },
  {
    value: "arabic-and-translations",
    label: "Arabic + translations",
    description: "Copy the Arabic verse text and the selected translations.",
  },
  {
    value: "translations",
    label: "Translations only",
    description: "Copy only the selected translations.",
  },
];

export function VerseCopySettings() {
  const { prefs, setPref } = usePreferences();
  const selectedTranslationIds = prefs.copyTranslationIds?.length
    ? prefs.copyTranslationIds
    : [...SUPPORTED_TRANSLATION_IDS];

  function setCopyMode(mode: CopyVerseContentMode) {
    setPref("copyVerseContentMode", mode);
  }

  function toggleCopyTranslation(id: TranslationId) {
    const next = selectedTranslationIds.includes(id)
      ? selectedTranslationIds.filter((x) => x !== id)
      : [...selectedTranslationIds, id];

    if (next.length === 0) return;
    setPref("copyTranslationIds", next);
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Copy Verse
      </h3>

      <div className="space-y-3">
        <div className="grid gap-2">
          {COPY_MODES.map((mode) => {
            const active = prefs.copyVerseContentMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setCopyMode(mode.value)}
                aria-pressed={active}
                className="rounded-lg border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                  backgroundColor: active ? "var(--color-surface)" : "var(--color-bg)",
                }}
              >
                <div className="text-sm font-medium text-[var(--color-text)]">
                  {mode.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  {mode.description}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Copy Translations
          </div>
          <div className="grid gap-2">
            {SUPPORTED_TRANSLATION_IDS.map((id) => {
              const active = selectedTranslationIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCopyTranslation(id)}
                  aria-pressed={active}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                    backgroundColor: active ? "var(--color-surface)" : "var(--color-bg)",
                  }}
                >
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {TRANSLATION_DISPLAY_NAMES[id]}
                  </div>
                  {active && (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Used when copying translations from verse views and the floating menu.
          </p>
        </div>
      </div>
    </section>
  );
}
