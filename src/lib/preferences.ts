import { DEFAULT_PREFERENCES, type MushafCode, type UserPreferences } from "./types";

// Re-export for scripts compatibility
export type { MushafCode };

const STORAGE_KEY = "quran-preferences";

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const current = getPreferences();
  const next = { ...current, [key]: value };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("preferences-changed", { detail: next }));
}

export function getDefaultMushaf(): MushafCode {
  return getPreferences().mushafCode;
}
