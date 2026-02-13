"use client";

import { useLayoutEffect, useState } from "react";

export function useElementSize(el: HTMLElement | null) {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useLayoutEffect(() => {
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return size;
}

