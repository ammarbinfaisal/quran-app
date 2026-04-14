import type { ReactNode } from "react";
import { TRANSLATION_DISPLAY_NAMES, type TranslationId } from "@/lib/types";

const HIDEABLE_TITLES = new Set(["Dr. ", "Shaykh "]);

export function renderTranslationName(id: TranslationId): ReactNode {
  const name = TRANSLATION_DISPLAY_NAMES[id] ?? id;
  const parts = name.split(/(\bDr\. |\bShaykh )/g).filter(Boolean);
  return parts.map((part, idx) =>
    HIDEABLE_TITLES.has(part) ? (
      <span key={idx} className="hidden sm:inline">
        {part}
      </span>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}
