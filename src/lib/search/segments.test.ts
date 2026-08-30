import { describe, expect, test } from "bun:test";
import { alignSegmentStarts, buckwalterToNormalizedLetters } from "./segments";

describe("buckwalterToNormalizedLetters", () => {
  test("maps letters and drops marks the way normalizeArabic does", () => {
    expect(buckwalterToNormalizedLetters("bi")).toBe("ب");
    expect(buckwalterToNormalizedLetters("{ll~ahi")).toBe("الله");
    expect(buckwalterToNormalizedLetters("r~aHoma`ni")).toBe("رحمن");
    expect(buckwalterToNormalizedLetters("Ea`lamiyna")).toBe("علمين"); // dagger alef dropped, as in ٱلْعَـٰلَمِينَ
    expect(buckwalterToNormalizedLetters("$ayo'K")).toBe("شيء");
  });

  test("reads a waw seat for a dagger alef as an alef, like normalizeArabic", () => {
    expect(buckwalterToNormalizedLetters("Salaw`pa")).toBe("صلاه"); // ٱلصَّلَوٰةَ
    expect(buckwalterToNormalizedLetters("sama`wa`ti")).toBe("سموت"); // ٱلسَّمَـٰوَٰتِ: real waw
  });

  test("throws on characters outside the corpus alphabet", () => {
    expect(() => buckwalterToNormalizedLetters("ab?")).toThrow();
  });
});

describe("alignSegmentStarts", () => {
  test("marks every segment start, including those inside words", () => {
    // بسم الله الرحمن الرحيم → bi+somi | {ll~ahi | {l+r~aHoma`ni | {l+r~aHiymi
    const aligned = alignSegmentStarts("بسم الله الرحمن الرحيم", [
      "bi",
      "somi",
      "{ll~ahi",
      "{l",
      "r~aHoma`ni",
      "{l",
      "r~aHiymi",
    ]);
    expect(aligned).toEqual({ starts: [0, 1, 4, 9, 11, 16, 18], consumed: 22 });
  });

  test("treats a hamza as optional on either side", () => {
    expect(alignSegmentStarts("الاخره", ["{lo", "'aAxirapi"])).toEqual({ starts: [0, 2], consumed: 6 });
    expect(alignSegmentStarts("الءاخره", ["{lo", "aAxirapi"])).toEqual({ starts: [0, 2], consumed: 7 });
  });

  test("skips text spaces the corpus does not have (بعد ما vs بعدما)", () => {
    expect(alignSegmentStarts("بعد ما سمعه", ["baEoda", "maA", "samiEa", "hu"])).toEqual({
      starts: [0, 4, 7, 10],
      consumed: 11,
    });
  });

  test("reports what it consumed when the corpus is missing trailing words", () => {
    expect(alignSegmentStarts("سلم علي ال ياسين", ["sala`mN", "EalaY`", "{lo"])).toEqual({
      starts: [0, 4, 8],
      consumed: 10,
    });
  });

  test("returns null on a real letter mismatch", () => {
    expect(alignSegmentStarts("الحمد", ["{lo", "Hamodu", "x"])).toBeNull();
    expect(alignSegmentStarts("كتاب", ["kitAbN", "Hu"])).toBeNull();
  });
});
