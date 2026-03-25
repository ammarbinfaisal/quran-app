"use client";

import { useLayoutEffect, useRef } from "react";
import { TOTAL_PAGES } from "@/lib/constants";
import { useMountEffect } from "@/hooks/useMountEffect";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
}

export function useDirectionalReaderKeyboardNav({
  type,
  id,
  onNavigate,
}: {
  type: "p" | "s" | "j";
  id: number;
  onNavigate: (nextType: "p" | "s" | "j", nextId: number) => void;
}): void {
  const onNavigateRef = useRef(onNavigate);

  useLayoutEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useMountEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowLeft") {
        let previousId: number | null = null;
        if (type === "p" && id > 1) previousId = id - 1;
        if (type === "s" && id > 1) previousId = id - 1;
        if (type === "j" && id > 1) previousId = id - 1;
        if (previousId === null) return;
        event.preventDefault();
        onNavigateRef.current(type, previousId);
      } else if (event.key === "ArrowRight") {
        let nextId: number | null = null;
        if (type === "p" && id < TOTAL_PAGES) nextId = id + 1;
        if (type === "s" && id < 114) nextId = id + 1;
        if (type === "j" && id < 30) nextId = id + 1;
        if (nextId === null) return;
        event.preventDefault();
        onNavigateRef.current(type, nextId);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });
}
