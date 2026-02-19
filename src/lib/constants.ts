export const TOTAL_PAGES = 604;
export const TOTAL_CHAPTERS = 114;
export const LINES_PER_PAGE = 15;
export const LINES_PER_PAGE_16 = 16;

export const API_BASE = "https://api.quran.com/api/v4";
export const FONT_CDN = "https://static.qurancdn.com/fonts/quran/hafs";

/** Translation resource IDs on api.quran.com */
export const TRANSLATION_IDS = {
  SAHEEH_INTERNATIONAL: 20,
  HILALI_KHAN: 203,
} as const;

/** Reciter IDs on api.quran.com */
export const RECITER_IDS = {
  HUSARY: 6,
  HUSARY_MUALLIM: 12,
  MISHARI: 7,
} as const;

export const FONT_PRELOAD_RADIUS = 2;
export const FONT_CLEANUP_RADIUS = 5;
export const HISTORY_MAX_ENTRIES = 10;
export const READING_HISTORY_DEBOUNCE_MS = 2000;
