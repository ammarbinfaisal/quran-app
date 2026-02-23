import { test, expect, type Page } from "@playwright/test";

const MUSHAF_CODES = ["v1", "v2", "v4", "qpc", "i15"] as const;
const TEST_PAGE = 3;
const MUSHAF_LINES: Record<string, number> = {
  v1: 15, v2: 15, v4: 15, qpc: 15, i15: 15,
};

/** Wait for mushaf words to render (font loaded, shimmer gone). */
async function waitForWords(page: Page) {
  await page.waitForSelector(
    ".mushaf-word.mushaf-text, .mushaf-word.mushaf-text-unicode",
    { state: "visible", timeout: 30_000 }
  );
}

/**
 * Get the visible .mushaf-page — the swipe reader renders 3 pages (prev, current, next).
 * Pick the one whose center is closest to the viewport center.
 */
async function getVisibleMushafPage(page: Page) {
  const viewport = page.viewportSize()!;
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  const pages = page.locator(".mushaf-page");
  const count = await pages.count();

  for (let i = 0; i < count; i++) {
    const box = await pages.nth(i).boundingBox();
    if (!box) continue;
    if (
      box.x <= centerX &&
      centerX <= box.x + box.width &&
      box.y <= centerY &&
      centerY <= box.y + box.height
    ) {
      return { locator: pages.nth(i), box };
    }
  }

  const first = pages.first();
  const box = await first.boundingBox();
  return { locator: first, box: box! };
}

// ---------------------------------------------------------------------------
// Test suite: basic rendering
// ---------------------------------------------------------------------------

test.describe("Mushaf rendering", () => {
  for (const code of MUSHAF_CODES) {
    test(`${code} — renders visible words on page ${TEST_PAGE}`, async ({ page }) => {
      await page.goto(`/p/${code}/${TEST_PAGE}`, { waitUntil: "networkidle" });
      await waitForWords(page);

      const { locator: mushafPage } = await getVisibleMushafPage(page);

      // Line count: .mushaf-line only wraps data lines (not headers/bismillah).
      // Page 3 has surah headers that consume line slots, so just verify >= 1.
      const lineCount = await mushafPage.locator(".mushaf-line").count();
      expect(lineCount).toBeGreaterThanOrEqual(1);

      // The total direct children of .mushaf-page should be maxLines + 1 (page number div)
      const childCount = await mushafPage.locator("> div").count();
      expect(childCount).toBe(MUSHAF_LINES[code] + 1); // +1 for page-number

      // At least some words rendered with non-zero size
      const words = mushafPage.locator(
        ".mushaf-word.mushaf-text, .mushaf-word.mushaf-text-unicode"
      );
      const wordCount = await words.count();
      expect(wordCount).toBeGreaterThan(0);

      const firstBox = await words.first().boundingBox();
      expect(firstBox).not.toBeNull();
      expect(firstBox!.width).toBeGreaterThan(0);
      expect(firstBox!.height).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Test suite: overflow:hidden is applied on .mushaf-page (visual containment)
// ---------------------------------------------------------------------------

test.describe("Mushaf containment — overflow:hidden on page container", () => {
  for (const code of MUSHAF_CODES) {
    test(`${code} — .mushaf-page has overflow:hidden`, async ({ page }) => {
      await page.goto(`/p/${code}/${TEST_PAGE}`, { waitUntil: "networkidle" });
      await waitForWords(page);

      const { locator: mushafPage } = await getVisibleMushafPage(page);

      const overflow = await mushafPage.evaluate(
        (el) => window.getComputedStyle(el).overflow
      );
      expect(overflow).toBe("hidden");
    });
  }
});

// ---------------------------------------------------------------------------
// Test suite: containment — words that ARE visible are inside the page rect
//
// boundingBox() returns the layout box (before clipping), so for QCF fonts
// some words may have layout positions slightly outside the container.
// We verify that the *visual intersection* exists — i.e. most of the word's
// width overlaps the page. Words fully outside would have zero overlap.
// ---------------------------------------------------------------------------

test.describe("Mushaf containment — visible words overlap page rect", () => {
  for (const code of MUSHAF_CODES) {
    test(`${code} — words on page ${TEST_PAGE} overlap .mushaf-page`, async ({ page }) => {
      await page.goto(`/p/${code}/${TEST_PAGE}`, { waitUntil: "networkidle" });
      await waitForWords(page);

      const { locator: mushafPage, box: pageBox } = await getVisibleMushafPage(page);
      expect(pageBox).not.toBeNull();

      const words = mushafPage.locator(
        ".mushaf-word.mushaf-text, .mushaf-word.mushaf-text-unicode"
      );
      const wordCount = await words.count();
      expect(wordCount).toBeGreaterThan(0);

      const pageLeft = pageBox.x;
      const pageRight = pageBox.x + pageBox.width;

      // Sample up to 40 words
      const step = Math.max(1, Math.floor(wordCount / 40));
      let outsideCount = 0;

      for (let i = 0; i < wordCount; i += step) {
        const wordBox = await words.nth(i).boundingBox();
        if (!wordBox || wordBox.width === 0) continue;

        const wordLeft = wordBox.x;
        const wordRight = wordBox.x + wordBox.width;

        // Compute horizontal overlap
        const overlapLeft = Math.max(pageLeft, wordLeft);
        const overlapRight = Math.min(pageRight, wordRight);
        const overlap = overlapRight - overlapLeft;

        // Word should have at least 50% of its width overlapping the page.
        // Words at the very edge may protrude slightly due to glyph metrics.
        if (overlap < wordBox.width * 0.5) {
          outsideCount++;
        }
      }

      // No more than 5% of sampled words should be mostly outside the page
      const sampled = Math.ceil(wordCount / step);
      expect(outsideCount).toBeLessThanOrEqual(Math.max(1, Math.ceil(sampled * 0.05)));
    });
  }
});

// ---------------------------------------------------------------------------
// Test suite: justified alignment — lines span most of the page width
// ---------------------------------------------------------------------------

test.describe("Mushaf justified alignment", () => {
  for (const code of MUSHAF_CODES) {
    test(`${code} — text lines are justified (span ≥70% of page width)`, async ({ page }) => {
      await page.goto(`/p/${code}/${TEST_PAGE}`, { waitUntil: "networkidle" });
      await waitForWords(page);

      const { locator: mushafPage, box: pageBox } = await getVisibleMushafPage(page);
      const usableWidth = pageBox.width * 0.92;

      const lines = mushafPage.locator(".mushaf-line");
      const lineCount = await lines.count();

      let justifiedCount = 0;
      for (let i = 0; i < lineCount; i++) {
        const lineWords = lines.nth(i).locator(
          ".mushaf-word.mushaf-text, .mushaf-word.mushaf-text-unicode"
        );
        const wc = await lineWords.count();
        if (wc < 2) continue;

        let minX = Infinity;
        let maxXEnd = -Infinity;
        for (let w = 0; w < wc; w++) {
          const wb = await lineWords.nth(w).boundingBox();
          if (!wb || wb.width === 0) continue;
          if (wb.x < minX) minX = wb.x;
          if (wb.x + wb.width > maxXEnd) maxXEnd = wb.x + wb.width;
        }

        if (minX === Infinity) continue;

        const lineSpread = maxXEnd - minX;
        if (lineSpread >= usableWidth * 0.7) {
          justifiedCount++;
        }
      }

      expect(justifiedCount).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Test suite: page 300 containment (mid-Quran, no special headers)
// ---------------------------------------------------------------------------

test.describe("Mushaf containment — page 300", () => {
  for (const code of MUSHAF_CODES) {
    test(`${code} — page 300 words overlap .mushaf-page`, async ({ page }) => {
      await page.goto(`/p/${code}/300`, { waitUntil: "networkidle" });
      await waitForWords(page);

      const { locator: mushafPage, box: pageBox } = await getVisibleMushafPage(page);
      expect(pageBox).not.toBeNull();

      const words = mushafPage.locator(
        ".mushaf-word.mushaf-text, .mushaf-word.mushaf-text-unicode"
      );
      const wordCount = await words.count();
      expect(wordCount).toBeGreaterThan(0);

      const pageLeft = pageBox.x;
      const pageRight = pageBox.x + pageBox.width;

      const step = Math.max(1, Math.floor(wordCount / 30));
      let outsideCount = 0;

      for (let i = 0; i < wordCount; i += step) {
        const wordBox = await words.nth(i).boundingBox();
        if (!wordBox || wordBox.width === 0) continue;

        const overlapLeft = Math.max(pageLeft, wordBox.x);
        const overlapRight = Math.min(pageRight, wordBox.x + wordBox.width);
        const overlap = overlapRight - overlapLeft;

        if (overlap < wordBox.width * 0.5) {
          outsideCount++;
        }
      }

      const sampled = Math.ceil(wordCount / step);
      expect(outsideCount).toBeLessThanOrEqual(Math.max(1, Math.ceil(sampled * 0.05)));
    });
  }
});
