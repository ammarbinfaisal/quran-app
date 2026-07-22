import { expect, test } from "@playwright/test";

const BOOKMARKS_STORAGE_KEY = "quran-bookmarks:v1";

test.use({
  viewport: { width: 390, height: 844 },
});

test.describe("Verse bookmarks", () => {
  test("saves a tapped verse under default and custom labels", async ({ page }) => {
    await page.goto("/p/1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelectorAll('.mushaf-word[data-verse-key="1:1"]').length > 0,
      { timeout: 30_000 },
    );

    await page.locator('.mushaf-word[data-verse-key="1:1"]').first().click();
    await page.getByLabel("Manage bookmarks").click();

    const savedToggle = page.getByRole("checkbox", {
      name: "Bookmark this verse under Saved",
    });
    await expect(savedToggle).toBeVisible();
    await savedToggle.click();
    await expect(savedToggle).toHaveAttribute("aria-checked", "true");

    await page.getByLabel("New bookmark label").fill("Review");
    await page.getByLabel("Create bookmark label").click();

    const reviewToggle = page.getByRole("checkbox", {
      name: "Bookmark this verse under Review",
    });
    await expect(reviewToggle).toHaveAttribute("aria-checked", "true");

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, BOOKMARKS_STORAGE_KEY);

    expect(stored.labels.map((label: { name: string }) => label.name)).toContain(
      "Review",
    );
    expect(
      stored.bookmarks.filter(
        (bookmark: { verseKey: string }) => bookmark.verseKey === "1:1",
      ),
    ).toHaveLength(2);
  });
});
