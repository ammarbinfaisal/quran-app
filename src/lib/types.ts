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
  verseKey: string;
  saheeh?: string;
  khanHilali?: string;
  abuIyaad?: string;
}

export type { Settings } from "@/lib/preferences";
export { DEFAULT_SETTINGS } from "@/lib/preferences";
