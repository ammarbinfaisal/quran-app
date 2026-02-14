import { test, expect, type Page, type CDPSession } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const EVIDENCE_DIR = path.join(process.cwd(), "ss_evidence");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// Network throttling presets (Chrome DevTools Protocol)
const NETWORK_PRESETS = {
  // Slow 4G: ~1.5 Mbps down, ~750 Kbps up, 300ms latency
  slow4g: {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 300,
  },
  // Regular 4G: ~4 Mbps down, ~3 Mbps up, 100ms latency
  regular4g: {
    offline: false,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
    latency: 100,
  },
  // Fast 3G: ~1.5 Mbps down, ~750 Kbps up, 562ms latency
  fast3g: {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 562,
  },
};

type NetworkPreset = keyof typeof NETWORK_PRESETS;

async function throttleNetwork(
  page: Page,
  preset: NetworkPreset
): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.emulateNetworkConditions", NETWORK_PRESETS[preset]);
  return session;
}

async function measurePageMetrics(page: Page) {
  return page.evaluate(() => {
    const perf = performance;
    const navigation = perf.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;

    // Get paint timings
    const paintEntries = perf.getEntriesByType("paint");
    const fcp = paintEntries.find(
      (e) => e.name === "first-contentful-paint"
    )?.startTime;
    const fp = paintEntries.find((e) => e.name === "first-paint")?.startTime;

    // Get LCP from PerformanceObserver (set up in addInitScript)
    type PerfWindow = Window & {
      __perf_lcp?: number;
      __perf_cls?: number;
    };
    const w = window as PerfWindow;

    return {
      // Navigation timing
      ttfb: navigation?.responseStart - navigation?.requestStart,
      domContentLoaded:
        navigation?.domContentLoadedEventEnd - navigation?.startTime,
      load: navigation?.loadEventEnd - navigation?.startTime,
      // Paint timing
      firstPaint: fp ?? null,
      firstContentfulPaint: fcp ?? null,
      // Observed metrics
      largestContentfulPaint: w.__perf_lcp ?? null,
      cumulativeLayoutShift: w.__perf_cls ?? null,
      // Resource counts
      resourceCount: perf.getEntriesByType("resource").length,
      totalTransferSize: perf
        .getEntriesByType("resource")
        .reduce(
          (sum, r) => sum + ((r as PerformanceResourceTiming).transferSize || 0),
          0
        ),
    };
  });
}

function setupPerfObservers(page: Page) {
  return page.addInitScript(() => {
    type PerfWindow = Window & {
      __perf_lcp?: number;
      __perf_cls?: number;
    };
    const w = window as PerfWindow;
    w.__perf_lcp = 0;
    w.__perf_cls = 0;

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) w.__perf_lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!shift.hadRecentInput) {
            w.__perf_cls = (w.__perf_cls ?? 0) + (shift.value ?? 0);
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });
}

// Only run perf tests in Chromium (CDP is Chromium-only)
test.describe("Page Load Performance", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CDP throttling requires Chromium"
  );

  test.beforeEach(async () => {
    await ensureDir(EVIDENCE_DIR);
  });

  test("surah page loads under 3s on regular 4G", async ({ page }) => {
    await setupPerfObservers(page);
    const session = await throttleNetwork(page, "regular4g");

    const startTime = Date.now();
    await page.goto("/1", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000); // Let metrics settle
    const elapsed = Date.now() - startTime;

    const metrics = await measurePageMetrics(page);

    const report = {
      test: "surah-load-regular4g",
      url: "/1",
      network: "regular4g",
      elapsed,
      ...metrics,
    };

    await fs.writeFile(
      path.join(EVIDENCE_DIR, "perf-surah-regular4g.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("Regular 4G metrics:", JSON.stringify(report, null, 2));

    // FCP should be under 3 seconds on regular 4G
    if (metrics.firstContentfulPaint !== null) {
      expect(metrics.firstContentfulPaint).toBeLessThan(3000);
    }

    await session.detach();
  });

  test("surah page loads on slow 4G (stress test)", async ({ page }) => {
    await setupPerfObservers(page);
    const session = await throttleNetwork(page, "slow4g");

    const startTime = Date.now();
    await page.goto("/1", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const elapsed = Date.now() - startTime;

    const metrics = await measurePageMetrics(page);

    const report = {
      test: "surah-load-slow4g",
      url: "/1",
      network: "slow4g",
      elapsed,
      ...metrics,
    };

    await fs.writeFile(
      path.join(EVIDENCE_DIR, "perf-surah-slow4g.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("Slow 4G metrics:", JSON.stringify(report, null, 2));

    // On slow 4G, FCP should still be under 6 seconds
    if (metrics.firstContentfulPaint !== null) {
      expect(metrics.firstContentfulPaint).toBeLessThan(6000);
    }

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "slow4g-surah1.png"),
    });

    await session.detach();
  });

  test("home page loads under 2s on regular 4G", async ({ page }) => {
    await setupPerfObservers(page);
    const session = await throttleNetwork(page, "regular4g");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const metrics = await measurePageMetrics(page);

    const report = {
      test: "home-load-regular4g",
      url: "/",
      network: "regular4g",
      ...metrics,
    };

    await fs.writeFile(
      path.join(EVIDENCE_DIR, "perf-home-regular4g.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("Home page metrics:", JSON.stringify(report, null, 2));

    if (metrics.firstContentfulPaint !== null) {
      expect(metrics.firstContentfulPaint).toBeLessThan(2000);
    }

    await session.detach();
  });

  test("CLS stays under 0.1 during surah page load", async ({ page }) => {
    await setupPerfObservers(page);

    await page.goto("/2", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const metrics = await measurePageMetrics(page);

    console.log("CLS:", metrics.cumulativeLayoutShift);

    if (metrics.cumulativeLayoutShift !== null) {
      expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1);
    }
  });

  test("rapid surah navigation doesn't break rendering", async ({ page }) => {
    // Navigate rapidly between multiple surahs
    const surahs = [1, 36, 67, 78, 2, 55];

    for (const surah of surahs) {
      await page.goto(`/${surah}`, { waitUntil: "domcontentloaded" });
    }

    // The last page (Ar-Rahman / surah 55) should render
    await expect(page.getByText("Ar-Rahman")).toBeVisible({ timeout: 10_000 });
  });

  test("resource transfer sizes are reasonable", async ({ page }) => {
    await page.goto("/1", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const resources = await page.evaluate(() => {
      return performance.getEntriesByType("resource").map((r) => {
        const res = r as PerformanceResourceTiming;
        return {
          name: res.name.split("/").pop(),
          type: res.initiatorType,
          transferSize: res.transferSize,
          duration: Math.round(res.duration),
        };
      });
    });

    const totalKB = resources.reduce((s, r) => s + r.transferSize, 0) / 1024;
    console.log(`Total transfer: ${totalKB.toFixed(0)} KB`);
    console.log(
      "Largest resources:",
      resources
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 5)
        .map((r) => `${r.name}: ${(r.transferSize / 1024).toFixed(1)}KB`)
    );

    // Total page weight should be under 1MB (excluding fonts loaded later)
    expect(totalKB).toBeLessThan(1024);
  });
});
