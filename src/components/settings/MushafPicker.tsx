"use client";

import { usePreferences } from "@/hooks/usePreferences";
import { MUSHAF_CODES, MUSHAF_DISPLAY_NAMES, type MushafCode } from "@/lib/types";

export function MushafPicker() {
  const { prefs, setPref } = usePreferences();

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Mushaf
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {MUSHAF_CODES.map((code) => {
          const active = prefs.mushafCode === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setPref("mushafCode", code as MushafCode)}
              className="rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div className="text-sm font-medium text-[var(--color-text)]">
                {MUSHAF_DISPLAY_NAMES[code]}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                {code}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
