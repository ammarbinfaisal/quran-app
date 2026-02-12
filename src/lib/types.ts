export interface Chapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
  pages: [number, number];
  revelationPlace: "makkah" | "madinah";
  translatedName: { name: string };
}

export interface Juz {
  id: number;
  juzNumber: number;
  verseMapping: Record<string, string>;
  firstVerseId: number;
  lastVerseId: number;
  versesCount: number;
}

export interface Translation {
  resourceId: number;
  resourceName: string;
  text: string;
  verseKey: string;
}

export interface AyahTranslations {
  verseKey: string; // e.g. "2:255"
  saheeh?: string;
  khanHilali?: string;
  abuIyaad?: string;
}

// Settings stored in localStorage
export interface Settings {
  // Which API translators to show (can pick one or both)
  apiTranslators: number[]; // subset of [20, 85]
  // Whether to show Abu Iyaad when available (always shown alongside selected)
  showAbuIyaad: boolean;
  // If Abu Iyaad is available for a verse, prefer showing it first
  preferAbuIyaad: boolean;
  mushafLayout: "hafs-v2" | "hafs-v4" | "hafs-unicode";
}

export const DEFAULT_SETTINGS: Settings = {
  apiTranslators: [20], // Saheeh International by default
  showAbuIyaad: true,
  preferAbuIyaad: true,
  mushafLayout: "hafs-v2",
};
