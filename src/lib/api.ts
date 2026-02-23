import { API_BASE } from "./constants";
import type { Chapter, TranslationEntry, AudioFile } from "./types";

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------
async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------
interface ChaptersResponse {
  chapters: Array<{
    id: number;
    name_simple: string;
    name_arabic: string;
    verses_count: number;
    pages: [number, number];
    revelation_place: "makkah" | "madinah";
    bismillah_pre: boolean;
  }>;
}

let chaptersCache: Chapter[] | null = null;

export async function fetchChapters(): Promise<Chapter[]> {
  if (chaptersCache) return chaptersCache;
  const data = await apiFetch<ChaptersResponse>("/chapters", { language: "en" });
  chaptersCache = data.chapters.map((c) => ({
    id: c.id,
    nameSimple: c.name_simple,
    nameArabic: c.name_arabic,
    versesCount: c.verses_count,
    pages: c.pages,
    revelationPlace: c.revelation_place,
    bismillahPre: c.bismillah_pre,
  }));
  return chaptersCache;
}

// ---------------------------------------------------------------------------
// Verses by page (for fetching translations on demand)
// ---------------------------------------------------------------------------
interface VersesResponse {
  verses?: Array<{
    verse_key: string;
    text_uthmani?: string;
    translations?: Array<{ resource_id: number; text: string }>;
  }>;
  verse?: {
    verse_key: string;
    text_uthmani?: string;
    translations?: Array<{ resource_id: number; text: string }>;
  };
}

export async function fetchVerseTranslations(
  verseKey: string,
  translationApiId: number,
): Promise<string> {
  const data = await apiFetch<VersesResponse>(`/verses/by_key/${verseKey}`, {
    translations: translationApiId,
    translation_fields: "resource_name",
    fields: "text_uthmani",
  });
  const verse = data.verse ?? data.verses?.[0];
  if (!verse) return "";
  const t = verse.translations?.find((tr) => tr.resource_id === translationApiId);
  return t?.text ?? "";
}

export async function fetchPageTranslations(
  pageNumber: number,
  translationApiId: number,
): Promise<TranslationEntry[]> {
  const data = await apiFetch<VersesResponse>(`/verses/by_page/${pageNumber}`, {
    translations: translationApiId,
    per_page: 50,
    fields: "text_uthmani",
  });
  const entries: TranslationEntry[] = [];
  for (const v of data.verses ?? []) {
    const t = v.translations?.find((tr) => tr.resource_id === translationApiId);
    if (t) {
      entries.push({ verseKey: v.verse_key, text: t.text });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Uthmani text for a full verse (for copy)
// ---------------------------------------------------------------------------
export async function fetchUthmaniText(verseKey: string): Promise<string> {
  const data = await apiFetch<VersesResponse>(`/verses/by_key/${verseKey}`, {
    fields: "text_uthmani",
  });
  const verse = data.verse ?? data.verses?.[0];
  return verse?.text_uthmani ?? "";
}

// ---------------------------------------------------------------------------
// Footnotes
// ---------------------------------------------------------------------------
interface FootnoteResponse {
  foot_note: {
    id: number;
    text: string;
    language_name: string;
  };
}

const footnoteCache = new Map<string, string>();

export async function fetchFootnote(footnoteId: string): Promise<string> {
  const cached = footnoteCache.get(footnoteId);
  if (cached !== undefined) return cached;

  try {
    const data = await apiFetch<FootnoteResponse>(`/foot_notes/${footnoteId}`);
    const text = data.foot_note?.text ?? "";
    footnoteCache.set(footnoteId, text);
    return text;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Audio (chapter-level)
// ---------------------------------------------------------------------------
interface ChapterRecitationResponse {
  audio_file: {
    chapter_id: number;
    audio_url: string;
    file_size: number;
  };
}

export async function fetchChapterAudio(
  reciterId: number,
  chapterId: number,
): Promise<AudioFile> {
  const data = await apiFetch<ChapterRecitationResponse>(
    `/chapter_recitations/${reciterId}/${chapterId}`,
  );
  return {
    chapterId: data.audio_file.chapter_id,
    url: data.audio_file.audio_url,
    fileSize: data.audio_file.file_size,
  };
}
