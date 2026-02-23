import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mobile emulation
// ---------------------------------------------------------------------------
test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForMushafRender(page: Page) {
    await page.waitForSelector(".mushaf-word", { timeout: 30_000 });
}

/** Read the page number from the URL path (e.g. /5/v2 → 5).
 *  Polls with retries to account for the 300ms debounce in useShallowUrl. */
async function getDisplayedPage(page: Page): Promise<number> {
    // Wait for URL to update (useShallowUrl has 300ms debounce)
    await page.waitForTimeout(500);
    const url = page.url();
    const match = url.match(/\/(\d+)(?:\/|$)/);
    if (match) {
        return Number.parseInt(match[1], 10);
    }
    // Fallback: read from the page indicator button
    const text = await page.locator("button").filter({ hasText: /^\d+$/ }).first().textContent({ timeout: 3000 }).catch(() => "0");
    return Number.parseInt(text?.trim() ?? "0", 10);
}

/** Perform a swipe forward (next page). */
async function swipeForward(page: Page) {
    const container = page.locator(".swipe-container");
    const info = await container.evaluate((el) => {
        const dir = getComputedStyle(el).direction;
        const before = el.scrollLeft;
        const cw = el.clientWidth;
        // In RTL with "negative" scrollLeft (Chrome): 
        //   scrollLeft = 0 is rightmost, goes negative to the left
        //   Forward (next page, higher number) = scroll LEFT = more negative
        //   scrollBy({left: -cw}) goes left = forward
        // In LTR: scrollBy({left: +cw}) goes right = forward
        const delta = dir === "rtl" ? -cw : cw;
        el.scrollBy({ left: delta, behavior: "smooth" });
        const afterImmediate = el.scrollLeft;
        return { dir, before, afterImmediate, delta, cw };
    });
    console.log("[swipeForward]", JSON.stringify(info));
}

async function swipeBackward(page: Page) {
    const container = page.locator(".swipe-container");
    await container.evaluate((el) => {
        const dir = getComputedStyle(el).direction;
        const cw = el.clientWidth;
        const delta = dir === "rtl" ? cw : -cw;
        el.scrollBy({ left: delta, behavior: "smooth" });
    });
}

/** Read all swipe debug log entries from window.__swipeLog. */
async function getSwipeLog(page: Page): Promise<Record<string, unknown>[]> {
    return page.evaluate(() => {
        const w = window as unknown as { __swipeLog?: Record<string, unknown>[] };
        return w.__swipeLog ?? [];
    });
}

/** Clear the swipe debug log. */
async function clearSwipeLog(page: Page) {
    await page.evaluate(() => {
        const w = window as unknown as { __swipeLog?: Record<string, unknown>[] };
        w.__swipeLog = [];
    });
}

/** Assert the displayed page equals expected, with retry and detailed logging. */
async function assertPage(page: Page, expected: number, label: string) {
    const actual = await getDisplayedPage(page);
    if (actual !== expected) {
        const log = await getSwipeLog(page);
        const recentLog = log.slice(-20);
        console.log(`[FAIL:${label}] Expected page ${expected}, got ${actual}`);
        console.log(`[FAIL:${label}] Recent swipe log:`, JSON.stringify(recentLog, null, 2));
    }
    expect(actual, `${label}: expected page ${expected}`).toBe(expected);
}

/** Wait and repeatedly assert the page stays stable at the expected value. */
async function assertPageStable(page: Page, expected: number, label: string) {
    // Check immediately
    await assertPage(page, expected, `${label}@0ms`);

    // Check after 1s
    await page.waitForTimeout(1000);
    await assertPage(page, expected, `${label}@1000ms`);

    // Check after 1.4s
    await page.waitForTimeout(400);
    await assertPage(page, expected, `${label}@1400ms`);

    // Check after 2s
    await page.waitForTimeout(600);
    await assertPage(page, expected, `${label}@2000ms`);
}

// ---------------------------------------------------------------------------
// 1. Direct navigation + swipe right (finger left→right = next page in RTL)
// ---------------------------------------------------------------------------
test.describe("Swipe from direct URL navigation", () => {
    test("navigate to page 5, swipe forward, verify page 6 is stable", async ({ page }) => {
        await page.goto("/p/v2/5");
        await waitForMushafRender(page);
        await clearSwipeLog(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(5);

        // Swipe forward (next page)
        await swipeForward(page);
        await page.waitForTimeout(500); // wait for scroll-snap to settle

        // Assert page 6 is displayed and remains stable
        await assertPageStable(page, 6, "swipe-forward-from-5");

        // Dump log for debugging
        const log = await getSwipeLog(page);
        console.log("[swipe-forward-from-5] Full log:", JSON.stringify(log, null, 2));
    });

    test("navigate to page 10, swipe backward, verify page 9 is stable", async ({ page }) => {
        await page.goto("/p/v2/10");
        await waitForMushafRender(page);
        await clearSwipeLog(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(10);

        // Swipe backward (previous page)
        await swipeBackward(page);
        await page.waitForTimeout(500);

        await assertPageStable(page, 9, "swipe-backward-from-10");
    });

    test("navigate to page 1, swipe forward twice, verify page 3", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(1);

        // First swipe
        await swipeForward(page);
        await page.waitForTimeout(800);
        await assertPage(page, 2, "first-swipe-from-1");

        // Second swipe
        await clearSwipeLog(page);
        await swipeForward(page);
        await page.waitForTimeout(800);
        await assertPageStable(page, 3, "second-swipe-from-1");
    });
});

// ---------------------------------------------------------------------------
// 2. Jump via Navigation Picker, then swipe
// ---------------------------------------------------------------------------
test.describe("Swipe after Navigation Picker jump", () => {
    test("jump to Al-Baqarah page 2, then swipe forward", async ({ page }) => {
        // Start at page 1
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);

        // Show chrome by tapping the reading area (use force to avoid overlay issues)
        await page.evaluate(() => (window as unknown as { __showChrome?: () => void }).__showChrome?.());
        await page.waitForTimeout(500);

        // Open navigation picker — click the page indicator button
        const navButton = page.locator("button").filter({ hasText: /^\d+$/ });
        await navButton.first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(500);

        // Select Al-Baqarah (chapter 2) — it starts at page 2
        // Surah list is inside the fixed bottom sheet container
        const surahList = page.locator(".fixed.bottom-0");
        // Playwright tests expect exact text, Surah names might render with '2. Al-Baqarah' or similar
        const surahButton = surahList.locator('button').filter({ hasText: /Al-Baqarah/i }).first();
        await surahButton.click();
        await page.waitForTimeout(300);

        // Select page column — find the "Page" tab if available, or the page entry
        // Look for a page number to click
        const pageEntry = surahList.locator("button").filter({ hasText: /^2$/ }).first();
        if (await pageEntry.isVisible({ timeout: 1000 }).catch(() => false)) {
            await pageEntry.click();
        }
        await page.waitForTimeout(500);

        // Try to navigate — click "Go" or similar, or close picker if auto-navigating
        // The nav picker auto-navigates on selection in some implementations
        await page.waitForTimeout(500);

        // After jump, verify the page number and then swipe
        await waitForMushafRender(page);
        const jumpedPage = await getDisplayedPage(page);
        // Al-Baqarah starts at page 2
        expect(jumpedPage).toBeGreaterThanOrEqual(2);

        await clearSwipeLog(page);

        // Now swipe forward
        await swipeForward(page);
        await page.waitForTimeout(500);

        // Should be at jumpedPage + 1
        await assertPageStable(page, jumpedPage + 1, `swipe-after-jump-${jumpedPage}`);
    });
});

// ---------------------------------------------------------------------------
// 3. Chained swipes and jumps — stress test
// ---------------------------------------------------------------------------
test.describe("Chained swipes and navigation jumps", () => {
    test("multiple forward swipes in sequence", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);

        let currentExpected = 1;

        for (let i = 0; i < 5; i++) {
            await clearSwipeLog(page);
            await swipeForward(page);
            await page.waitForTimeout(800);
            currentExpected++;
            await assertPage(page, currentExpected, `chain-swipe-${i}`);
        }

        // Final stability check
        await assertPageStable(page, currentExpected, "chain-swipe-final");
    });

    test("alternating forward and backward swipes", async ({ page }) => {
        await page.goto("/p/v2/5");
        await waitForMushafRender(page);

        let currentExpected = 5;

        // Forward
        await swipeForward(page);
        await page.waitForTimeout(800);
        currentExpected = 6;
        await assertPage(page, currentExpected, "alt-1-forward");

        // Forward again
        await swipeForward(page);
        await page.waitForTimeout(800);
        currentExpected = 7;
        await assertPage(page, currentExpected, "alt-2-forward");

        // Backward
        await swipeBackward(page);
        await page.waitForTimeout(800);
        currentExpected = 6;
        await assertPage(page, currentExpected, "alt-3-backward");

        // Forward
        await swipeForward(page);
        await page.waitForTimeout(800);
        currentExpected = 7;
        await assertPage(page, currentExpected, "alt-4-forward");

        // Backward twice
        await swipeBackward(page);
        await page.waitForTimeout(800);
        currentExpected = 6;
        await assertPage(page, currentExpected, "alt-5-backward");

        await swipeBackward(page);
        await page.waitForTimeout(800);
        currentExpected = 5;
        await assertPageStable(page, currentExpected, "alt-6-backward-stable");
    });

    test("keyboard jump then swipe then keyboard", async ({ page }) => {
        await page.goto("/p/v2/3");
        await waitForMushafRender(page);

        // Start at page 3
        await assertPage(page, 3, "start");

        // Keyboard forward (ArrowLeft = next in RTL)
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(500);
        await assertPage(page, 4, "keyboard-forward");

        // Swipe forward
        await swipeForward(page);
        await page.waitForTimeout(800);
        await assertPage(page, 5, "swipe-after-keyboard");

        // Keyboard backward (ArrowRight = prev in RTL)
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(500);
        await assertPage(page, 4, "keyboard-backward");

        // Swipe backward
        await swipeBackward(page);
        await page.waitForTimeout(800);
        await assertPageStable(page, 3, "swipe-backward-after-keyboard");
    });

    test("rapid consecutive swipes don't break state", async ({ page }) => {
        await page.goto("/p/v2/5");
        await waitForMushafRender(page);
        await assertPage(page, 5, "start");

        // Rapid fire 3 forward swipes with minimal delay
        await swipeForward(page);
        await page.waitForTimeout(300);
        await swipeForward(page);
        await page.waitForTimeout(300);
        await swipeForward(page);

        // Wait for everything to settle
        await page.waitForTimeout(2000);

        // The page should have advanced — exact value may vary
        // but it MUST be > 5 and MUST be stable
        const settled = await getDisplayedPage(page);
        expect(settled).toBeGreaterThan(5);
        expect(settled).toBeLessThanOrEqual(8); // At most 3 forward

        // And it must remain stable
        await page.waitForTimeout(1000);
        const stillSettled = await getDisplayedPage(page);
        expect(stillSettled).toBe(settled);

        console.log(`[rapid-swipe] Settled at page ${settled}`);
        const log = await getSwipeLog(page);
        console.log("[rapid-swipe] Full log:", JSON.stringify(log, null, 2));
    });
});

// ---------------------------------------------------------------------------
// 4. URL navigation to random pages + swipe stability
// ---------------------------------------------------------------------------
test.describe("Random page swipe stability", () => {
    const testPages = [50, 100, 200, 300, 400, 500];

    for (const startPage of testPages) {
        test(`page ${startPage}: swipe forward and verify stability`, async ({ page }) => {
            await page.goto(`/${startPage}/v2`);
            await waitForMushafRender(page);
            await clearSwipeLog(page);

            const initial = await getDisplayedPage(page);
            expect(initial).toBe(startPage);

            await swipeForward(page);
            await page.waitForTimeout(500);

            await assertPageStable(page, startPage + 1, `random-${startPage}`);
        });
    }
});

// ---------------------------------------------------------------------------
// 5. Partial Swipes
// ---------------------------------------------------------------------------
test.describe("Partial Swipes", () => {
    test("touch drag without releasing does not trigger premature layout jump", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);
        await assertPage(page, 1, "start");

        // Simulate touch and drag (partial swipe)
        const container = page.locator(".swipe-container");
        const box = await container.boundingBox();
        if (!box) throw new Error("Could not find swipe container bounding box");

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Drag slightly to peer to next page
        await page.mouse.move(startX - 50, startY, { steps: 10 });

        // Hold for 300ms (to check if old 150ms timeout fires)
        await page.waitForTimeout(300);

        // Before releasing, page should still officially be 1
        await assertPage(page, 1, "during-partial-swipe");

        // Move back to origin and release (aborted swipe)
        await page.mouse.move(startX, startY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Page should remain 1
        await assertPageStable(page, 1, "after-aborted-swipe");
    });
});
