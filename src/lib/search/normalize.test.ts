import { describe, expect, test } from "bun:test";
import { countSearchLetters, normalizeArabic, normalizeArabicWithElisions } from "./normalize";

// The three assertions pinned by rust-api/src/normalization.rs, plus a few edges.
describe("normalizeArabic", () => {
  test("strips diacritics and tatweel", () => {
    expect(normalizeArabic("ٱلْحَمْـدُ لِلَّٰهِ")).toBe("الحمد لله");
  });

  test("normalizes alef forms and ya", () => {
    expect(normalizeArabic("إِنَّ ٱلْهُدَىٰ هُدَى ٱللَّهِ")).toBe("ان الهدي هدي الله");
  });

  test("condenses whitespace and punctuation", () => {
    expect(normalizeArabic("الرَّحْمٰنِ،  الرَّحِيمِ")).toBe("الرحمن الرحيم");
  });

  test("maps hamza carriers and taa marbuta", () => {
    expect(normalizeArabic("مُؤْمِنٌ شَيْءٌ رَحْمَة")).toBe("مومن شيء رحمه");
  });

  test("keeps latin alphanumerics and drops symbols", () => {
    expect(normalizeArabic("  hello, 1:1 !")).toBe("hello 1 1");
    expect(normalizeArabic("،؟!")).toBe("");
  });

  test("folds a hamza written before an alef into the alef, like آ", () => {
    expect(normalizeArabic("ءَامَنُوا۟")).toBe("امنوا");
    expect(normalizeArabic("آمَنُوا")).toBe("امنوا");
    expect(normalizeArabic("ٱلْقُرْءَانَ")).toBe("القران");
    expect(normalizeArabic("جَآءَ شَيْءٍ")).toBe("جاء شيء");
  });

  test("reads a waw carrying a dagger alef as an alef", () => {
    expect(normalizeArabic("ٱلصَّلَوٰةَ")).toBe("الصلاه");
    expect(normalizeArabic("ٱلْحَيَوٰةِ ٱلدُّنْيَا")).toBe("الحياه الدنيا");
    // A waw with its own haraka before the dagger is a real letter (ٱلسَّمَـٰوَٰتِ).
    expect(normalizeArabic("ٱلسَّمَـٰوَٰتِ")).toBe("السموت");
  });
});

describe("normalizeArabicWithElisions", () => {
  test("records dagger alefs by their position in the normalized text", () => {
    expect(normalizeArabicWithElisions("ٱلْعَـٰلَمِينَ")).toEqual({
      text: "العلمين",
      elisions: [{ offset: 3, letter: "ا" }],
    });
    expect(normalizeArabicWithElisions("ذَٰلِكَ ٱلسَّمَـٰوَٰتِ")).toEqual({
      text: "ذلك السموت",
      elisions: [
        { offset: 1, letter: "ا" },
        { offset: 8, letter: "ا" },
        { offset: 9, letter: "ا" },
      ],
    });
  });

  test("ignores the dagger on alef maqsura and on a waw seat", () => {
    expect(normalizeArabicWithElisions("عَلَىٰ").elisions).toEqual([]);
    expect(normalizeArabicWithElisions("ٱلصَّلَوٰةَ").elisions).toEqual([]);
  });

  test("records small yeh/waw/noon and a hamza on a tatweel", () => {
    expect(normalizeArabicWithElisions("إِبْرَٰهِـۧمَ")).toEqual({
      text: "ابرهم",
      elisions: [
        { offset: 3, letter: "ا" },
        { offset: 4, letter: "ي" },
      ],
    });
    expect(normalizeArabicWithElisions("بِهِۦ").elisions).toEqual([{ offset: 2, letter: "ي" }]);
    expect(normalizeArabicWithElisions("لَهُۥ").elisions).toEqual([{ offset: 2, letter: "و" }]);
    expect(normalizeArabicWithElisions("نُـۨجِى").elisions).toEqual([{ offset: 1, letter: "ن" }]);
    expect(normalizeArabicWithElisions("شَيْـًٔا")).toEqual({
      text: "شيا",
      elisions: [{ offset: 2, letter: "ي" }],
    });
  });

  test("never elides at the start of a word", () => {
    expect(normalizeArabicWithElisions("ٰذلك").elisions).toEqual([]);
    expect(normalizeArabicWithElisions("ذ ٰلك").elisions).toEqual([]);
  });
});

describe("countSearchLetters", () => {
  test("counts normalized letters without spaces", () => {
    expect(countSearchLetters("و ما")).toBe(3);
    expect(countSearchLetters("مَا")).toBe(2);
    expect(countSearchLetters("  ،  ")).toBe(0);
  });
});
