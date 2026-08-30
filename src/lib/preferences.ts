import {
  DEFAULT_PREFERENCES,
  type MushafCode,
  type TranslationId,
  type UserPreferences,
} from "./types";

// Re-export for scripts compatibility
export type { MushafCode };

const STORAGE_KEY = "quran-preferences";

// Abu Iyaad is not a user-selectable display translation — it is always shown
// wherever it has data. The Translation picker only toggles saheeh/hilali-khan,
// but it writes the whole translationIds array, so any stored value it wrote
// drops abu-iyaad permanently. Re-add it on every read rather than depending on
// what happens to be in localStorage.
//
// Deliberately not applied to copyTranslationIds: the Copy Verse settings do
// expose abu-iyaad as an explicit toggle, so deselecting it there is a real
// user choice to respect.
const ALWAYS_ON_TRANSLATION_ID: TranslationId = "abu-iyaad";

function withAlwaysOnTranslations(ids: unknown): TranslationId[] {
  const list = Array.isArray(ids) ? (ids as TranslationId[]) : [];
  return list.includes(ALWAYS_ON_TRANSLATION_ID)
    ? list
    : [...list, ALWAYS_ON_TRANSLATION_ID];
}

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const stored = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    return {
      ...stored,
      translationIds: withAlwaysOnTranslations(stored.translationIds),
    };
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
