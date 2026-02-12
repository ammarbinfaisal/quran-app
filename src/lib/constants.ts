// Translator resource IDs from Quran Foundation API
// Saheeh International = 20
// Dr. Muhsin Khan & Taqi ud-Din al-Hilali = 85
// (IDs confirmed via /resources/translations endpoint)
export const TRANSLATOR_IDS = {
  SAHEEH_INTERNATIONAL: 20,
  KHAN_AL_HILALI: 85,
} as const;

export const TRANSLATOR_LABELS: Record<number, string> = {
  20: "Saheeh International",
  85: "Khan & al-Hilali",
};

export type TranslatorId = (typeof TRANSLATOR_IDS)[keyof typeof TRANSLATOR_IDS];

export const TOTAL_SURAHS = 114;
export const TOTAL_JUZS = 30;
export const TOTAL_PAGES = 604;
