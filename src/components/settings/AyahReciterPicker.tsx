"use client";

import { usePreferences } from "@/hooks/usePreferences";
import {
  AYAH_RECITER_DISPLAY_NAMES,
  SUPPORTED_AYAH_RECITERS,
} from "@/lib/types";

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
                <div className="min-w-0 text-sm font-medium text-[var(--color-text)]">
                  {AYAH_RECITER_DISPLAY_NAMES[id]}
                </div>
                {active ? (
                  <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
