"use client";

import { usePreferences } from "@/hooks/usePreferences";
import { DATA_USAGE_MODES, DATA_USAGE_MODE_DETAILS } from "@/lib/dataUsage";
import type { DataUsageMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DataUsageModePicker() {
  const { prefs, setPref } = usePreferences();

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Data Usage
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {DATA_USAGE_MODES.map((mode) => {
          const detail = DATA_USAGE_MODE_DETAILS[mode];
          const active = prefs.dataUsageMode === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => setPref("dataUsageMode", mode as DataUsageMode)}
              aria-pressed={active}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
              )}
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: active ? "var(--color-surface)" : "var(--color-bg)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {detail.label}
                </span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    active ? "bg-[var(--color-accent)]" : "bg-[var(--color-muted)]/30",
                  )}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted)]">
                {detail.shortDescription}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-pretty text-xs leading-5 text-[var(--color-muted)]">
        The docs page explains the exact background warming behavior for each mode.
      </p>
    </section>
  );
}
