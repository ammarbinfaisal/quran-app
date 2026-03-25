"use client";

import { usePreferences } from "@/hooks/usePreferences";
import {
  AYAH_RECITER_DISPLAY_NAMES,
  SUPPORTED_AYAH_RECITERS,
  type AyahReciterId,
} from "@/lib/types";

const RECITER_DESCRIPTIONS: Record<AyahReciterId, string> = {
  "abdul-basit": "Murattal with measured pacing and a fuller tonal character.",
  husary: "Murattal known for clarity, steadiness, and precision in tajweed.",
  minshawi: "Murattal balancing softness and melody without sacrificing itqan.",
};

export function AyahReciterPicker() {
  const { prefs, setPref } = usePreferences();

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Ayah Reciter
      </h3>
      <div className="grid gap-2">
        {SUPPORTED_AYAH_RECITERS.map((id) => {
          const active = prefs.ayahReciterId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPref("ayahReciterId", id)}
              aria-pressed={active}
              className="rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: active ? "var(--color-surface)" : "var(--color-bg)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {AYAH_RECITER_DISPLAY_NAMES[id]}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                    {RECITER_DESCRIPTIONS[id]}
                  </div>
                </div>
                {active ? (
                  <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Used by the ayah play button in the floating verse actions.
      </p>
    </section>
  );
}
