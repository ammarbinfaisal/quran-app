/**
 * Canonical verse reference formatter.
 *
 * Unified display format: `{SurahName} · {surahId}:{ayahs}[ · word N]`
 * - `ayahs` is a single number (`25`) or a range (`4-5`, ASCII hyphen).
 * - Word position is appended with an explicit label, never as `2:2:2`.
 *
 * Examples:
 *   - single verse with name:  `Al-Kahf · 18:5`
 *   - same-surah range:        `Al-Kahf · 18:5-7`
 *   - cross-surah range:       `Al-Kahf · 18:110 - Maryam · 19:1`
 *   - fallback without name:   `18:5`
 *   - word index:              `Al-Kahf · 18:5 · word 3`
 *
 * Pure helper: callers pass `surahName` explicitly; we do not resolve it
 * from the chapters dataset here.
 */
export function formatVerseRef(opts: {
  surahName?: string | null;
  surahId: number;
  ayahStart: number;
  ayahEnd?: number; // if omitted or equal to ayahStart, single verse
  wordIndex?: number; // 1-based; if provided, appends " · word N"
}): string {
  const { surahName, surahId, ayahStart, ayahEnd, wordIndex } = opts;
  const ayahs =
    ayahEnd && ayahEnd !== ayahStart ? `${ayahStart}-${ayahEnd}` : `${ayahStart}`;
  const core = surahName
    ? `${surahName} · ${surahId}:${ayahs}`
    : `${surahId}:${ayahs}`;
  return wordIndex ? `${core} · word ${wordIndex}` : core;
}
