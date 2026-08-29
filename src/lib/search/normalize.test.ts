import { describe, expect, test } from "bun:test";
import { normalizeArabic } from "./normalize";

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
});
