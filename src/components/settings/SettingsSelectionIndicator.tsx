"use client";

import { cn } from "@/lib/utils";

export function SettingsSelectionIndicator({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        active ? "bg-[var(--color-accent)]" : "bg-[var(--color-muted)]/30",
      )}
      aria-hidden="true"
    />
  );
}
