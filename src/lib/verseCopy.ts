import { fetchUthmaniText } from "@/lib/api";
import { loadTranslation } from "@/lib/translations/loader";
import { TRANSLATION_DISPLAY_NAMES, type TranslationId } from "@/lib/types";

export type VerseCopyMode = "arabic" | "arabic-and-translations" | "translations";

export interface VerseCopySettings {
  copyVerseContentMode?: VerseCopyMode;
  copyTranslationIds?: TranslationId[];
}

function dedupeTranslationIds(ids: TranslationId[]): TranslationId[] {
  return Array.from(new Set(ids));
}

function formatTranslationSection(id: TranslationId, text: string): string {
  const label = TRANSLATION_DISPLAY_NAMES[id] ?? id;
  return `${label}\n${text}`;
}

async function loadTranslationSection(verseKey: string, id: TranslationId): Promise<string | null> {
  try {
    const content = await loadTranslation(verseKey, id);
    if (!content.plain) return null;
    return formatTranslationSection(id, content.plain);
  } catch {
    return null;
  }
}

export async function buildVerseCopyText({
  verseKey,
  mode,
  translationIds,
}: {
  verseKey: string;
  mode: VerseCopyMode;
  translationIds: TranslationId[];
}): Promise<string> {
  const sections: string[] = [];

  if (mode !== "translations") {
    try {
      const arabic = await fetchUthmaniText(verseKey);
      if (arabic) sections.push(arabic);
    } catch {
      // Ignore Arabic fetch failures and fall back to translations if any.
    }
  }

  if (mode !== "arabic") {
    const translationSections = await Promise.all(
      dedupeTranslationIds(translationIds).map((id) => loadTranslationSection(verseKey, id)),
    );

    for (const section of translationSections) {
      if (section) sections.push(section);
    }
  }

  return sections.join("\n\n").trim();
}

