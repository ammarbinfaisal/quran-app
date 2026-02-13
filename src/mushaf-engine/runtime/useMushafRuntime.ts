"use client";

import { useEffect, useMemo } from "react";
import type { MushafCode } from "@/lib/preferences";
import { MushafRuntime } from "@/mushaf-engine/runtime/MushafRuntime";

export function useMushafRuntime(mushafCode: MushafCode) {
  const runtime = useMemo(() => new MushafRuntime(mushafCode), [mushafCode]);

  useEffect(() => {
    return () => runtime.dispose();
  }, [runtime]);

  return runtime;
}

