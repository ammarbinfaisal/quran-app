"use client";

import { useEffect, useRef } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Point = { x: number; y: number };

function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function usePinchZoom(params: {
  enabled: boolean;
  scrollEl: HTMLElement | null;
  spacerRef: { current: HTMLElement | null };
  contentRef: { current: HTMLElement | null };
  zoomRef: { current: number };
  baseContentHeightPx: number;
  onAfterApply?: () => void;
  minScale?: number;
  maxScale?: number;
}) {
  const {
    enabled,
    scrollEl,
    spacerRef,
    contentRef,
    zoomRef,
    baseContentHeightPx,
    onAfterApply,
    minScale = 1,
    maxScale = 2.25,
  } = params;

  const rafRef = useRef<number | null>(null);
  const pendingScaleRef = useRef<number | null>(null);

  const pointersRef = useRef(new Map<number, Point>());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  useEffect(() => {
    if (!enabled) return;
    const spacerEl = spacerRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !spacerEl || !contentEl) return;

    const pointers = pointersRef.current;
    const spacerNode = spacerEl;
    const contentNode = contentEl;

    contentNode.style.transformOrigin = "top center";
    contentNode.style.willChange = "transform";

    const applyScale = (scale: number) => {
      const next = clamp(scale, minScale, maxScale);
      zoomRef.current = next;
      contentNode.style.transform = `scale(${next})`;
      spacerNode.style.height = `${Math.round(baseContentHeightPx * next)}px`;
      onAfterApply?.();
    };

    applyScale(zoomRef.current || 1);

    const scheduleApply = (nextScale: number) => {
      pendingScaleRef.current = nextScale;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingScaleRef.current;
        pendingScaleRef.current = null;
        if (pending == null) return;
        applyScale(pending);
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        scrollEl.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        pinchStartDistanceRef.current = Math.max(1, distance(pts[0], pts[1]));
        pinchStartScaleRef.current = zoomRef.current || 1;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2) return;

      const startDist = pinchStartDistanceRef.current;
      if (startDist == null) return;

      const pts = Array.from(pointers.values());
      const nextDist = Math.max(1, distance(pts[0], pts[1]));
      const ratio = nextDist / startDist;
      const nextScale = (pinchStartScaleRef.current || 1) * ratio;
      scheduleApply(nextScale);
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.delete(e.pointerId);
      try {
        scrollEl.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (pointers.size < 2) pinchStartDistanceRef.current = null;
    };

    // Trackpad pinch gesture usually maps to wheel+ctrl on desktop browsers.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const direction = e.deltaY < 0 ? 1 : -1;
      const step = 0.06;
      const next = (zoomRef.current || 1) * (1 + direction * step);
      scheduleApply(next);
    };

    scrollEl.addEventListener("pointerdown", onPointerDown, { passive: true });
    scrollEl.addEventListener("pointermove", onPointerMove, { passive: true });
    scrollEl.addEventListener("pointerup", onPointerUpOrCancel, { passive: true });
    scrollEl.addEventListener("pointercancel", onPointerUpOrCancel, { passive: true });
    scrollEl.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      scrollEl.removeEventListener("pointerdown", onPointerDown);
      scrollEl.removeEventListener("pointermove", onPointerMove);
      scrollEl.removeEventListener("pointerup", onPointerUpOrCancel);
      scrollEl.removeEventListener("pointercancel", onPointerUpOrCancel);
      scrollEl.removeEventListener("wheel", onWheel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      pendingScaleRef.current = null;
      pointers.clear();
      pinchStartDistanceRef.current = null;
    };
  }, [
    enabled,
    scrollEl,
    spacerRef,
    contentRef,
    zoomRef,
    baseContentHeightPx,
    onAfterApply,
    minScale,
    maxScale,
  ]);
}
