"use client";

import { Minus, Plus } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { applyResponsiveScales } from "@/lib/responsiveScale";

export function FontSizeControl() {
  const { prefs, setPref } = usePreferences();

  const setScale = (next: number) => {
    const clamped = Math.max(1, Math.min(10, next));
    applyResponsiveScales(clamped);
    setPref("fontScale", clamped);
  };

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Font Size
      </h3>
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3 py-3">
        <button
          type="button"
          onClick={() => setScale(prefs.fontScale - 1)}
          className="flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          aria-label="Decrease font size"
        >
          <Minus className="h-4 w-4 shrink-0" />
        </button>
        <div className="text-sm text-[var(--color-text)] tabular-nums">
          {prefs.fontScale}
        </div>
        <button
          type="button"
          onClick={() => setScale(prefs.fontScale + 1)}
          className="flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          aria-label="Increase font size"
        >
          <Plus className="h-4 w-4 shrink-0" />
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Adjusts reader text and interface sizing gently.
      </p>
    </section>
  );
}
