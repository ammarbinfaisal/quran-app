"use client";

import { useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";

function applyTheme(theme: string) {
  const root = document.documentElement;
  root.dataset.theme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  const color = theme === "dark" ? "#0e0e0e" : "#2d6a4f";
  if (meta) meta.setAttribute("content", color);
}

export function ThemeSync() {
  const { settings } = useSettings();

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  return null;
}
