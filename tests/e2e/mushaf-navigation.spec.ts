import { test, expect } from "@playwright/test";

test.describe("Mushaf Navigation", () => {
  test("home page loads and shows surah list", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Quran/);

    // Should display surah entries
    const firstSurah = page.getByText("Al-Fatihah");
    await expect(firstSurah).toBeVisible({ timeout: 15_000 });
  });

  test("surah page loads with mushaf content", async ({ page }) => {
    await page.goto("/1");

    // NavBar should show surah name
    await expect(page.getByText("Al-Fatihah")).toBeVisible({ timeout: 15_000 });

    // Page should have rendered (check for the nav + viewer wrapper)
    const wrapper = page.locator(".flex.flex-col.min-h-dvh");
    await expect(wrapper).toBeVisible();
  });

  test("navigating to different surahs works", async ({ page }) => {
    // Al-Baqarah (surah 2)
    await page.goto("/2");
    await expect(page.getByText("Al-Baqarah")).toBeVisible({ timeout: 15_000 });

    // Yasin (surah 36)
    await page.goto("/36");
    await expect(page.getByText("Ya-Sin")).toBeVisible({ timeout: 15_000 });

    // An-Nas (surah 114)
    await page.goto("/114");
    await expect(page.getByText("An-Nas")).toBeVisible({ timeout: 15_000 });
  });

  test("juz page loads correctly", async ({ page }) => {
    await page.goto("/juz/1");
    await expect(page.getByText("Juz 1")).toBeVisible({ timeout: 15_000 });
  });

  test("invalid surah returns 404", async ({ page }) => {
    const response = await page.goto("/999");
    expect(response?.status()).toBe(404);
  });
});
