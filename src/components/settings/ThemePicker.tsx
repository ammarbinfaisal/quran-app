"use client";

import { THEMES, type ThemeId } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { SettingsSelectionIndicator } from "@/components/settings/SettingsSelectionIndicator";

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(THEMES).map(([id, theme]) => {
          const active = prefs.theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id as ThemeId)}
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
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {theme.label}
                </div>
                <SettingsSelectionIndicator active={active} />
              </div>
              <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-[var(--color-muted)]/15">
                <span
                  className="h-3"
                  style={{ backgroundColor: theme.colors.bg }}
                />
                <span
                  className="h-3"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                <span
                  className="h-3"
                  style={{ backgroundColor: theme.colors.surface }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
