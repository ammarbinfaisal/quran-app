"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TAFSIR_IDS,
  TAFSIR_ARABIC_NAMES,
  TAFSIR_DISPLAY_NAMES,
  type TafsirId,
} from "@/lib/types";

interface TafsirSwitcherProps {
  active: TafsirId;
  onChange: (id: TafsirId) => void;
  /**
   * Tafsirs with data for the currently viewed ayah. When `null`, all tafsirs
   * are rendered — use this while availability is still loading to avoid
   * tabs popping in and out.
   */
  available?: readonly TafsirId[] | null;
  /** Tafsir currently fetching after a switch — shows an inline spinner. */
  pending?: TafsirId | null;
  className?: string;
}

export function TafsirSwitcher({
  active,
  onChange,
  available,
  pending = null,
  className,
}: TafsirSwitcherProps) {
  const visibleIds = available ?? TAFSIR_IDS;
  if (visibleIds.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide",
        className,
      )}
      role="tablist"
      aria-label="Tafsir"
    >
      {visibleIds.map((id) => {
        const selected = id === active;
        const isPending = pending === id;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={TAFSIR_DISPLAY_NAMES[id]}
            aria-busy={isPending || undefined}
            onClick={() => onChange(id)}
            className={cn(
              "group relative min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-sm outline-none transition whitespace-nowrap",
              "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
              selected
                ? "bg-[var(--color-accent)] text-[var(--color-bg)] shadow-sm"
                : "bg-[var(--color-surface)] text-[var(--color-text)] ring-1 ring-[var(--color-muted)]/20 hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-bg))] active:opacity-80",
              isPending && "opacity-70",
            )}
          >
            <span
              className={cn("font-arabic text-[0.95rem]", isPending && "opacity-40")}
              dir="rtl"
            >
              {TAFSIR_ARABIC_NAMES[id]}
            </span>
            {isPending && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
