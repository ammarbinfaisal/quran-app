"use client";

import { useState, useEffect, useCallback } from "react";
import { getPreferences, setPreference } from "@/lib/preferences";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";

/**
 * Reactive hook for user preferences.
 *
 * Reads from localStorage on mount and listens for the
 * "preferences-changed" CustomEvent so that all mounted
 * consumers stay in sync when any one of them writes.
 */
export function usePreferences(): {
  prefs: UserPreferences;
  setPref: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
} {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Read from localStorage on mount
  useEffect(() => {
    setPrefs(getPreferences());
  }, []);

  // Listen for cross-component preference changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UserPreferences>).detail;
      setPrefs(detail);
    };

    window.addEventListener("preferences-changed", handler);
    return () => {
      window.removeEventListener("preferences-changed", handler);
    };
  }, []);

  const setPref = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreference(key, value);
    },
    [],
  );

  return { prefs, setPref };
}
