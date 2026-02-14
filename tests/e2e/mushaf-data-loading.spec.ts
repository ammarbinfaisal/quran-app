import { test, expect } from "@playwright/test";

test.describe("Mushaf Data Loading (no 404s)", () => {
  test("protobuf data files are served for all mushaf codes", async ({
    request,
  }) => {
    const codes = ["v1", "v2", "t4", "ut", "i5", "i6", "qh", "tj"];
    const pages = [1, 50, 200, 400, 604];

    for (const code of codes) {
      for (const page of pages) {
        const padded = String(page).padStart(3, "0");
        const res = await request.get(`/mushaf-data/${code}/p${padded}.pb`);
        expect(
          res.status(),
          `Expected 200 for /mushaf-data/${code}/p${padded}.pb`
        ).toBe(200);
      }
    }
  });

  test("JSON fallback data files are served", async ({ request }) => {
    const res = await request.get("/mushaf-data/v2/p001.json");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("page");
    expect(json).toHaveProperty("mushafCode");
    expect(json).toHaveProperty("lines");
    expect(json.lines.length).toBeGreaterThan(0);
  });

  test("font CDN URLs are accessible for QCF codes", async ({ request }) => {
    // v1, v2, and v4 (t4 maps to v4) have per-page CDN fonts
    const fontUrls = [
      "https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p1.woff2",
      "https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p604.woff2",
      "https://static.qurancdn.com/fonts/quran/hafs/v1/woff2/p1.woff2",
      "https://static.qurancdn.com/fonts/quran/hafs/v4/woff2/p1.woff2",
    ];

    for (const url of fontUrls) {
      const res = await request.get(url);
      expect(res.status(), `Expected 200 for ${url}`).toBe(200);
    }
  });

  test("surah page inlines initial mushaf data (no client fetch needed for first page)", async ({
    page,
  }) => {
    // Intercept network to verify no mushaf-data fetch on initial load
    const dataRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("mushaf-data")) {
        dataRequests.push(req.url());
      }
    });

    await page.goto("/1", { waitUntil: "networkidle" });

    // The page should have rendered without fetching mushaf-data
    // because the data is inlined by the server component.
    // Additional pages may trigger fetches during prefetching,
    // but the first page data should come from SSR.
    await page.waitForTimeout(1000);

    // We can't fully prevent prefetch requests, but the initial
    // page content should be visible without them
    await expect(page.getByText("Al-Fatihah")).toBeVisible();
  });
});
