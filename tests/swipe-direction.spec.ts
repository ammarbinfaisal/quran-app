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
    const match = url.match(/\/p\/(\d+)(?:\/|$|\?)/);
    if (match) {
        return Number.parseInt(match[1], 10);
    }
    // Fallback: read from the page indicator button
    const text = await page.locator("button").filter({ hasText: /^\d+$/ }).first().textContent({ timeout: 3000 }).catch(() => "0");
    return Number.parseInt(text?.trim() ?? "0", 10);
}

async function scrollToSlot(page: Page, slotIndex: 0 | 1 | 2) {
    await page.evaluate(({ slotIndex }) => {
        const container = document.querySelector(".swipe-container") as HTMLElement | null;
        if (!container) throw new Error("Swipe container not found");
        const W = container.clientWidth;
        container.scrollTo({ left: slotIndex * W, behavior: "auto" });
    }, { slotIndex });
}

/** Swipe forward (next page). In the native scroll-snap reader, next page sits in the left slot. */
async function swipeForward(page: Page) {
    await scrollToSlot(page, 0);
}

/** Swipe backward (previous page). Previous page sits in the right slot. */
async function swipeBackward(page: Page) {
    await scrollToSlot(page, 2);
}

/** Assert the displayed page equals expected, with retry and detailed logging. */
async function assertPage(page: Page, expected: number, label: string) {
    const actual = await getDisplayedPage(page);
    if (actual !== expected) {
        console.log(`[FAIL:${label}] Expected page ${expected}, got ${actual}`);
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
        await page.goto("/p/5");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(5);

        // Swipe forward (next page)
        await swipeForward(page);
        await page.waitForTimeout(500); // wait for scroll-snap to settle

        // Assert page 6 is displayed and remains stable
        await assertPageStable(page, 6, "swipe-forward-from-5");
    });

    test("navigate to page 10, swipe backward, verify page 9 is stable", async ({ page }) => {
        await page.goto("/p/10");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(10);

        // Swipe backward (previous page)
        await swipeBackward(page);
        await page.waitForTimeout(500);

        await assertPageStable(page, 9, "swipe-backward-from-10");
    });

    test("navigate to page 1, swipe forward twice, verify page 3", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(1);

        // First swipe
        await swipeForward(page);
        await page.waitForTimeout(800);
        await assertPage(page, 2, "first-swipe-from-1");

        // Second swipe
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
        await page.goto("/p/1");
        await waitForMushafRender(page);

        // Show chrome by tapping the reading area (use force to avoid overlay issues)
        await page.evaluate(() => (window as unknown as { __showChrome?: () => void }).__showChrome?.());
        await page.waitForTimeout(500);

        // Open navigation picker — click the page indicator button
        const navButton = page.locator("button").filter({ hasText: /^\d+$/ });
        await navButton.first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(500);

        // Select Al-Baqarah (chapter 2) — it starts at page 2
        const sheet = page.locator(".fixed.inset-x-0.bottom-0");
        const surahButton = sheet.locator("button").filter({ hasText: /Al-Baqarah/i }).first();
        await surahButton.click();
        await page.waitForTimeout(300);

        const goButton = sheet.locator("button").filter({ hasText: /^Go to / }).first();
        await goButton.click({ timeout: 5000 });
        await page.waitForTimeout(500);

        // After jump, verify the page number and then swipe
        await waitForMushafRender(page);
        const jumpedPage = await getDisplayedPage(page);
        // Al-Baqarah starts at page 2
        expect(jumpedPage).toBeGreaterThanOrEqual(2);

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
        await page.goto("/p/1");
        await waitForMushafRender(page);

        let currentExpected = 1;

        for (let i = 0; i < 5; i++) {
            await swipeForward(page);
            await page.waitForTimeout(800);
            currentExpected++;
            await assertPage(page, currentExpected, `chain-swipe-${i}`);
        }

        // Final stability check
        await assertPageStable(page, currentExpected, "chain-swipe-final");
    });

    test("alternating forward and backward swipes", async ({ page }) => {
        await page.goto("/p/5");
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
        await page.goto("/p/3");
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
        await page.goto("/p/5");
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
    });
});

// ---------------------------------------------------------------------------
// 4. URL navigation to random pages + swipe stability
// ---------------------------------------------------------------------------
test.describe("Random page swipe stability", () => {
    const testPages = [50, 100, 200, 300, 400, 500];

    for (const startPage of testPages) {
        test(`page ${startPage}: swipe forward and verify stability`, async ({ page }) => {
            await page.goto(`/p/${startPage}`);
            await waitForMushafRender(page);

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
    test("small scroll (peek) does not change the page", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);
        await assertPage(page, 1, "start");

        await page.evaluate(() => {
            const container = document.querySelector(".swipe-container") as HTMLElement | null;
            if (!container) throw new Error("Swipe container not found");
            const W = container.clientWidth;
            // Start centered on the current page, then "peek" a bit toward the next page.
            container.scrollTo({ left: W - 40, behavior: "auto" });
        });

        await page.waitForTimeout(500);

        // Page should remain 1
        await assertPageStable(page, 1, "after-aborted-swipe");
    });
});
