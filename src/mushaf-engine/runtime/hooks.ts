"use client";

import { useEffect, useSyncExternalStore } from "react";
import type {
  FontSnapshot,
  MushafRuntime,
  PagePayloadSnapshot,
} from "@/mushaf-engine/runtime/MushafRuntime";

export function usePagePayload(
  runtime: MushafRuntime,
  page: number
): PagePayloadSnapshot {
  const snap = useSyncExternalStore(
    (cb) => runtime.subscribePagePayload(page, cb),
    () => runtime.getPagePayloadSnapshot(page),
    () => runtime.getPagePayloadSnapshot(page)
  );

  useEffect(() => {
    runtime.ensurePagePayload(page);
  }, [runtime, page]);

  return snap;
}

export function useFont(runtime: MushafRuntime, page: number): FontSnapshot {
  const snap = useSyncExternalStore(
    (cb) => runtime.subscribeFont(page, cb),
    () => runtime.getFontSnapshot(page),
    () => runtime.getFontSnapshot(page)
  );

  useEffect(() => {
    runtime.ensureFont(page);
  }, [runtime, page]);

  return snap;
}

