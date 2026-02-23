"use client";

import { Minus, Plus } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";

export function FontSizeControl() {
  const { prefs, setPref } = usePreferences();

  const setScale = (next: number) => {
    const clamped = Math.max(1, Math.min(10, next));
    document.documentElement.style.setProperty("--mushaf-font-scale", String(clamped));
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
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          aria-label="Decrease font size"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="text-sm text-[var(--color-text)] tabular-nums">
          {prefs.fontScale}
        </div>
        <button
          type="button"
          onClick={() => setScale(prefs.fontScale + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          aria-label="Increase font size"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Only applies in Verse-by-Verse and Morphology modes.
      </p>
    </section>
  );
}
