"use client";

import { useCallback } from "react";
import { setPreference } from "@/lib/preferences";
import type { ThemeId } from "@/lib/types";

export function useTheme() {
  const applyTheme = useCallback((theme: ThemeId) => {
    document.documentElement.setAttribute("data-theme", theme);
    setPreference("theme", theme);
  }, []);

  return { applyTheme };
}
