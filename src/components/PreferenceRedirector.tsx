"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";
import {
  parseReaderRouteSegments,
  buildCanonicalReaderPath,
  DEFAULT_SETTINGS,
  settingsEqual,
} from "@/lib/preferences";

export function PreferenceRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const { settings, hydrated } = useSettings();

  useEffect(() => {
    if (!hydrated) return;

    // Only redirect if the user has non-default settings
    if (settingsEqual(settings, DEFAULT_SETTINGS)) return;

    // Check if we are on a surah page: /[surah]/[[...ayah]]
    // Pathname looks like /1 or /1/7 or /1/r/m:v1/t:tr20
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return;

    const firstSegment = segments[0];
    const surahNum = Number(firstSegment);

    // If it's a number, it's potentially a surah page
    if (!isNaN(surahNum) && surahNum >= 1 && surahNum <= 114) {
      const routeSegments = segments.slice(1);
      const route = parseReaderRouteSegments(routeSegments);

      // If it's a "bare" route, we should redirect to the user's preferred canonical URL
      if (route.kind === "bare") {
        const target = buildCanonicalReaderPath({
          surah: surahNum,
          ayah: route.ayah,
          mushafCode: settings.mushafCode,
          translationCode: settings.translationCode,
        });
        
        // Use replace to avoid polluting history with the redirect
        router.replace(target);
      }
    }
  }, [pathname, hydrated, settings, router]);

  return null;
}
