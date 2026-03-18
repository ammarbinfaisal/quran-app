"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TapAnchor } from "@/lib/wordTap";

interface FloatingWordMenuButton {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export function FloatingWordMenu({
  anchor,
  buttons,
  onDismiss,
}: {
  anchor: TapAnchor;
  buttons: FloatingWordMenuButton[];
  onDismiss: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    left: anchor.x,
    top: anchor.y,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;

    const margin = 8;
    const gap = 14;
    const rect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchor.x - rect.width / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - rect.width - margin));

    let top = anchor.y - rect.height - gap;
    if (top < margin) {
      top = Math.min(anchor.y + gap, viewportHeight - rect.height - margin);
    }

    setStyle({
      left,
      top,
      visibility: "visible",
    });
  }, [anchor.x, anchor.y, buttons.length]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} />
      <div
        ref={menuRef}
        className="fixed z-50 flex items-center gap-1 rounded-full border border-[var(--color-muted)]/20 bg-[var(--color-surface)]/95 p-1 shadow-lg backdrop-blur"
        style={{ ...style, transition: "none" }}
        onClick={(event) => event.stopPropagation()}
        role="menu"
        aria-label="Word actions"
      >
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            onClick={button.onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text)] active:scale-[0.96] active:opacity-80 hover:bg-[var(--color-muted)]/10"
            style={{ transition: "none" }}
            aria-label={button.label}
            title={button.label}
          >
            {button.icon}
          </button>
        ))}
      </div>
    </>
  );
}
