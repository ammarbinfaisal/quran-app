"use client";

import { useEffect, useMemo } from "react";
import type { MushafCode } from "@/lib/preferences";
import type { MushafPagePayload } from "@/lib/mushaf/proto";
import { MushafRuntime } from "@/mushaf-engine/runtime/MushafRuntime";

import { useSettings } from "@/context/SettingsContext";

export function useMushafRuntime(
  mushafCode: MushafCode,
  initialData?: MushafPagePayload | null
) {
  const { settings } = useSettings();
  const runtime = useMemo(() => {
    const rt = new MushafRuntime(mushafCode, {
      lowStorageMode: settings.lowStorageMode,
    });
    if (initialData && initialData.mushafCode === mushafCode) {
      rt.seedPagePayload(initialData);
      rt.seedFont(initialData.page);
    }
    return rt;
  }, [mushafCode, initialData]);

  useEffect(() => {
    return () => runtime.dispose();
  }, [runtime]);

  return runtime;
}

