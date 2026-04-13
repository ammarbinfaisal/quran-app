export interface JuzPageRange {
  juz: number;
  pages: [startPage: number, endPage: number];
}

// Standard Madani mushaf juz page ranges (604 pages total).
// Source is consistent with Quran.com / Quran Foundation "pages lookup" behavior.
export const JUZ_PAGE_RANGES: readonly JuzPageRange[] = [
  { juz: 1, pages: [1, 21] },
  { juz: 2, pages: [22, 41] },
  { juz: 3, pages: [42, 61] },
  { juz: 4, pages: [62, 81] },
  { juz: 5, pages: [82, 101] },
  { juz: 6, pages: [102, 121] },
  { juz: 7, pages: [122, 141] },
  { juz: 8, pages: [142, 161] },
  { juz: 9, pages: [162, 181] },
  { juz: 10, pages: [182, 201] },
  { juz: 11, pages: [202, 221] },
  { juz: 12, pages: [222, 241] },
  { juz: 13, pages: [242, 261] },
  { juz: 14, pages: [262, 281] },
  { juz: 15, pages: [282, 301] },
  { juz: 16, pages: [302, 321] },
  { juz: 17, pages: [322, 341] },
  { juz: 18, pages: [342, 361] },
  { juz: 19, pages: [362, 381] },
  { juz: 20, pages: [382, 401] },
  { juz: 21, pages: [402, 421] },
  { juz: 22, pages: [422, 441] },
  { juz: 23, pages: [442, 461] },
  { juz: 24, pages: [462, 481] },
  { juz: 25, pages: [482, 501] },
  { juz: 26, pages: [502, 521] },
  { juz: 27, pages: [522, 541] },
  { juz: 28, pages: [542, 561] },
  { juz: 29, pages: [562, 581] },
  { juz: 30, pages: [582, 604] },
] as const;

export interface JuzVerseRange {
  juz: number;
  startVerse: string;
  endVerse: string;
}

// Standard juz verse boundaries (Hafs reading).
export const JUZ_VERSE_RANGES: readonly JuzVerseRange[] = [
  { juz: 1, startVerse: "1:1", endVerse: "2:141" },
  { juz: 2, startVerse: "2:142", endVerse: "2:252" },
  { juz: 3, startVerse: "2:253", endVerse: "3:92" },
  { juz: 4, startVerse: "3:93", endVerse: "4:23" },
  { juz: 5, startVerse: "4:24", endVerse: "4:147" },
  { juz: 6, startVerse: "4:148", endVerse: "5:81" },
  { juz: 7, startVerse: "5:82", endVerse: "6:110" },
  { juz: 8, startVerse: "6:111", endVerse: "7:87" },
  { juz: 9, startVerse: "7:88", endVerse: "8:40" },
  { juz: 10, startVerse: "8:41", endVerse: "9:92" },
  { juz: 11, startVerse: "9:93", endVerse: "11:5" },
  { juz: 12, startVerse: "11:6", endVerse: "12:52" },
  { juz: 13, startVerse: "12:53", endVerse: "14:52" },
  { juz: 14, startVerse: "15:1", endVerse: "16:128" },
  { juz: 15, startVerse: "17:1", endVerse: "18:74" },
  { juz: 16, startVerse: "18:75", endVerse: "20:135" },
  { juz: 17, startVerse: "21:1", endVerse: "22:78" },
  { juz: 18, startVerse: "23:1", endVerse: "25:20" },
  { juz: 19, startVerse: "25:21", endVerse: "27:55" },
  { juz: 20, startVerse: "27:56", endVerse: "29:45" },
  { juz: 21, startVerse: "29:46", endVerse: "33:30" },
  { juz: 22, startVerse: "33:31", endVerse: "36:27" },
  { juz: 23, startVerse: "36:28", endVerse: "39:31" },
  { juz: 24, startVerse: "39:32", endVerse: "41:46" },
  { juz: 25, startVerse: "41:47", endVerse: "45:37" },
  { juz: 26, startVerse: "46:1", endVerse: "51:30" },
  { juz: 27, startVerse: "51:31", endVerse: "57:29" },
  { juz: 28, startVerse: "58:1", endVerse: "66:12" },
  { juz: 29, startVerse: "67:1", endVerse: "77:50" },
  { juz: 30, startVerse: "78:1", endVerse: "114:6" },
] as const;

