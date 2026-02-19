"use client";

import type { ReadingMode } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";

export function ReadingModePicker() {
  const { prefs, setPref } = usePreferences();

  const setMode = (mode: ReadingMode) => setPref("readingMode", mode);

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Reading Mode
      </h3>
      <div className="flex gap-2">
        <ModeButton
          active={prefs.readingMode === "swipe"}
          onClick={() => setMode("swipe")}
          label="Swipe"
          description="Best for mobile"
        />
        <ModeButton
          active={prefs.readingMode === "scroll"}
          onClick={() => setMode("scroll")}
          label="Scroll"
          description="Vertical"
        />
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col rounded-lg border px-3 py-2 text-left transition-colors"
      style={{
        borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
      <span className="text-xs text-[var(--color-muted)]">{description}</span>
    </button>
  );
}
