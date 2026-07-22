import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
});

test.describe("Mushaf verse highlight", () => {
  test("renders verse-boundary overlay segments instead of per-word backgrounds", async ({
    page,
  }) => {
    await page.goto("/p/1?verse=1:5", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".mushaf-page", { timeout: 20_000 });
    await page.waitForFunction(
      () => document.querySelectorAll('.mushaf-word[data-verse-key="1:5"]').length > 0,
      { timeout: 30_000 },
    );
    await page.waitForSelector(".mushaf-verse-highlight-segment", {
      timeout: 10_000,
    });

    const segmentBoxes = await page
      .locator(".mushaf-verse-highlight-segment")
      .evaluateAll((segments) =>
        segments.map((segment) => {
          const rect = segment.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    expect(segmentBoxes.length).toBeGreaterThan(0);
    for (const box of segmentBoxes) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    const wordBackgrounds = await page
      .locator('.mushaf-word[data-verse-key="1:5"][data-highlighted="true"]')
      .evaluateAll((words) =>
        words.map((word) => getComputedStyle(word).backgroundColor),
      );
    expect(wordBackgrounds.length).toBeGreaterThan(0);
    for (const background of wordBackgrounds) {
      expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(background);
    }
  });
});
