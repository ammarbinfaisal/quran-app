"use client";

import { THEMES, type ThemeId } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { SettingsSelectionIndicator } from "@/components/settings/SettingsSelectionIndicator";

// Theme pairs for 2x2 grid display (light, dark)
const THEME_PAIRS: [ThemeId, ThemeId][] = [
  ["light-warm", "dark-warm"],
  ["white-green", "classic-dark"],
  ["blue-slate-light", "blue-slate-dark"],
];

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
      <div className="space-y-3">
        {THEME_PAIRS.map(([lightId, darkId]) => {
          const lightTheme = THEMES[lightId];
          const darkTheme = THEMES[darkId];
          // Extract pair name from label (e.g., "Warm Light" -> "Warm")
          const pairName = lightTheme.label.replace(" Light", "");

          return (
            <div key={`${lightId}-${darkId}`}>
              <div className="mb-1.5 text-xs text-[var(--color-muted)]">{pairName}</div>
              <div className="grid grid-cols-2 gap-2">
                <ThemeButton
                  id={lightId}
                  theme={lightTheme}
                  active={prefs.theme === lightId}
                  onSelect={setTheme}
                />
                <ThemeButton
                  id={darkId}
                  theme={darkTheme}
                  active={prefs.theme === darkId}
                  onSelect={setTheme}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ThemeButton({
  id,
  theme,
  active,
  onSelect,
}: {
  id: ThemeId;
  theme: (typeof THEMES)[ThemeId];
  active: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  // Show "Light" or "Dark" based on the theme label
  const shortLabel = theme.label.includes("Light") ? "Light" : "Dark";

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
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
          {shortLabel}
        </div>
        <SettingsSelectionIndicator active={active} />
      </div>
      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-[var(--color-muted)]/15">
        <span className="h-3" style={{ backgroundColor: theme.colors.bg }} />
        <span className="h-3" style={{ backgroundColor: theme.colors.accent }} />
        <span className="h-3" style={{ backgroundColor: theme.colors.surface }} />
      </div>
    </button>
  );
}
