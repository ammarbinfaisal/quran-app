"use client";

import { usePreferences } from "@/hooks/usePreferences";
import {
  TRANSLATION_DISPLAY_NAMES,
  type TranslationId,
} from "@/lib/types";

const TRANSLATIONS: TranslationId[] = ["saheeh", "hilali-khan", "abu-iyaad"];

export function TranslationPicker() {
  const { prefs, setPref } = usePreferences();

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Translation
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {TRANSLATIONS.map((id) => {
          const active = prefs.translationId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPref("translationId", id)}
              className="rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div className="text-sm font-medium text-[var(--color-text)]">
                {TRANSLATION_DISPLAY_NAMES[id]}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                {id}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Tap an ayah to view the selected translation.
      </p>
    </section>
  );
}
