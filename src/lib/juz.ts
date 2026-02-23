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

