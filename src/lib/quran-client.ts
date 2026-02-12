const BASE = "https://api.quran.com/api/v4";

export interface Chapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
  revelationPlace: string;
  translatedName: { name: string };
  pages: [number, number];
}

export interface Juz {
  id: number;
  juzNumber: number;
  verseMapping: Record<string, string>;
  firstVerseId: number;
  lastVerseId: number;
  versesCount: number;
}

export async function fetchChapters(): Promise<Chapter[]> {
  const res = await fetch(`${BASE}/chapters?language=en`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.chapters.map((c: any) => ({
    id: c.id,
    nameSimple: c.name_simple,
    nameArabic: c.name_arabic,
    versesCount: c.verses_count,
    revelationPlace: c.revelation_place,
    translatedName: { name: c.translated_name.name },
    pages: c.pages as [number, number],
  }));
}

export async function fetchJuzs(): Promise<Juz[]> {
  const res = await fetch(`${BASE}/juzs`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  // API returns each juz twice — deduplicate by juz_number
  const seen = new Set<number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.juzs.filter((j: any) => {
    if (seen.has(j.juz_number)) return false;
    seen.add(j.juz_number);
    return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).map((j: any) => ({
    id: j.id,
    juzNumber: j.juz_number,
    verseMapping: j.verse_mapping,
    firstVerseId: j.first_verse_id,
    lastVerseId: j.last_verse_id,
    versesCount: j.verses_count,
  }));
}
