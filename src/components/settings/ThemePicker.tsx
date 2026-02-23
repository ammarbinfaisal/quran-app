"use client";

import { THEMES, type ThemeId } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";

export function ThemePicker() {
  const { prefs, setPref } = usePreferences();
  const { applyTheme } = useTheme();

  function setTheme(id: ThemeId) {
    applyTheme(id);
    setPref("theme", id);
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Theme
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(THEMES).map(([id, theme]) => {
          const active = prefs.theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id as ThemeId)}
              className="rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div className="text-sm font-medium text-[var(--color-text)]">
                {theme.label}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: theme.colors.bg }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: theme.colors.text }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
