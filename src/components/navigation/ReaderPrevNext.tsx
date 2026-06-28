"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReaderPrevNextButton {
  label: string;
  action: () => void;
  disabled?: boolean;
}

/**
 * Shared previous/next navigation for reading modes.
 *
 * Visual order is `< >`: NEXT renders first (left, ChevronLeft) and PREVIOUS
 * renders second (right, ChevronRight). This matches the original scroll and
 * verse-by-verse reader layout, and is reused by the tafsir compact nav.
 */
export function ReaderPrevNext({
  prev,
  next,
  size = "full",
  className,
}: {
  prev: ReaderPrevNextButton | null;
  next: ReaderPrevNextButton | null;
  size?: "full" | "compact";
  className?: string;
}) {
  if (size === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <NavButton
          side="next"
          button={next}
          size="compact"
        />
        <NavButton
          side="prev"
          button={prev}
          size="compact"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-6", className)}>
      <NavButton side="next" button={next} size="full" />
      <NavButton side="prev" button={prev} size="full" />
    </div>
  );
}

function NavButton({
  side,
  button,
  size,
}: {
  side: "prev" | "next";
  button: ReaderPrevNextButton | null;
  size: "full" | "compact";
}) {
  if (!button) {
    return size === "full" ? <div className="flex-1" /> : null;
  }

  const ariaLabel = side === "prev" ? `Previous: ${button.label}` : `Next: ${button.label}`;

  if (size === "compact") {
    return (
      <button
        type="button"
        onClick={button.action}
        disabled={button.disabled}
        aria-label={ariaLabel}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
      >
        {side === "next" ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={button.action}
      disabled={button.disabled}
      aria-label={ariaLabel}
      className="flex-1 min-w-0 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-3 py-3 text-xs font-medium text-[var(--color-text)] active:scale-[0.98] active:opacity-80 transition flex items-center justify-center gap-1.5 truncate"
    >
      {side === "next" && <ChevronLeft className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{button.label}</span>
      {side === "prev" && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
