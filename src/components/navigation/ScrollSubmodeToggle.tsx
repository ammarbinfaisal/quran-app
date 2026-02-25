"use client";

import type { VbvSubmode } from "@/lib/types";
import { SubmodeToggle } from "@/components/navigation/SubmodeToggle";

interface ScrollSubmodeToggleProps {
  currentType: VbvSubmode;
  currentId: number;
  onNavigate: (type: VbvSubmode, id: number, verse?: string | null) => void;
}

export function ScrollSubmodeToggle({
  currentType,
  currentId,
  onNavigate,
}: ScrollSubmodeToggleProps) {
  return (
    <SubmodeToggle
      currentType={currentType}
      currentId={currentId}
      ariaLabel="Scroll submode"
      preferenceKey="scrollSubmode"
      scrollSelector="[data-scroll-reader]"
      onNavigate={onNavigate}
    />
  );
}
