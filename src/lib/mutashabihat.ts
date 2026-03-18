export interface MutashabihatOccurrence {
  from: number;
  to: number;
  text: string;
}

export interface MutashabihatPhraseGroup {
  surahs: number;
  ayahs: number;
  count: number;
  source: {
    key: string;
    from: number;
    to: number;
    text: string;
  };
  ayah: Record<string, MutashabihatOccurrence[]>;
}

type VersePhraseMap = Record<string, number[]>;
type PhraseMap = Record<string, MutashabihatPhraseGroup>;
type VerseTextMap = Record<string, string>;

let verseMapCache: VersePhraseMap | null = null;
let verseMapPromise: Promise<VersePhraseMap> | null = null;
let phraseMapCache: PhraseMap | null = null;
let phraseMapPromise: Promise<PhraseMap> | null = null;
let verseTextMapCache: VerseTextMap | null = null;
let verseTextMapPromise: Promise<VerseTextMap> | null = null;

export async function loadMutashabihatVerseMap(): Promise<VersePhraseMap> {
  if (verseMapCache) return verseMapCache;

  if (!verseMapPromise) {
    verseMapPromise = fetch("/data/mutashabihat/phrase-verses.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load mutashabihat verse map: ${res.status}`);
        return res.json() as Promise<VersePhraseMap>;
      })
      .then((data) => {
        verseMapCache = data;
        return data;
      })
      .catch((err) => {
        verseMapPromise = null;
        throw err;
      });
  }

  return verseMapPromise;
}

export async function loadMutashabihatPhraseMap(): Promise<PhraseMap> {
  if (phraseMapCache) return phraseMapCache;

  if (!phraseMapPromise) {
    phraseMapPromise = fetch("/data/mutashabihat/phrases.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load mutashabihat phrases: ${res.status}`);
        return res.json() as Promise<PhraseMap>;
      })
      .then((data) => {
        phraseMapCache = data;
        return data;
      })
      .catch((err) => {
        phraseMapPromise = null;
        throw err;
      });
  }

  return phraseMapPromise;
}

export async function loadMutashabihatVerseTextMap(): Promise<VerseTextMap> {
  if (verseTextMapCache) return verseTextMapCache;

  if (!verseTextMapPromise) {
    verseTextMapPromise = fetch("/data/mutashabihat/verse-texts.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load mutashabihat verse texts: ${res.status}`);
        return res.json() as Promise<VerseTextMap>;
      })
      .then((data) => {
        verseTextMapCache = data;
        return data;
      })
      .catch((err) => {
        verseTextMapPromise = null;
        throw err;
      });
  }

  return verseTextMapPromise;
}

export async function loadMutashabihatGroupsForVerse(
  verseKey: string,
): Promise<Array<{ id: number; group: MutashabihatPhraseGroup }>> {
  const [verseMap, phraseMap] = await Promise.all([
    loadMutashabihatVerseMap(),
    loadMutashabihatPhraseMap(),
  ]);

  return (verseMap[verseKey] ?? [])
    .map((id) => ({ id, group: phraseMap[String(id)] }))
    .filter((entry): entry is { id: number; group: MutashabihatPhraseGroup } => !!entry.group);
}
