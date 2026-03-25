"use client";

import { useMountEffect } from "@/hooks/useMountEffect";
import { getPreferences } from "@/lib/preferences";
import type { UserPreferences } from "@/lib/types";

function applyPrefsToDOM(prefs: UserPreferences) {
  document.documentElement.setAttribute("data-theme", prefs.theme);
  document.documentElement.style.setProperty(
    "--mushaf-font-scale",
    String(prefs.fontScale),
  );
}

export function useApplyPreferences() {
  useMountEffect(() => {
    applyPrefsToDOM(getPreferences());

    const handler = (e: Event) => {
      applyPrefsToDOM((e as CustomEvent<UserPreferences>).detail);
    };
    window.addEventListener("preferences-changed", handler);
    return () => window.removeEventListener("preferences-changed", handler);
  });
}
