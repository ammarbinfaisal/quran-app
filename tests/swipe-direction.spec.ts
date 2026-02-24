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

/** Read the page number from the URL path (e.g. /p/5 → 5). */
async function getDisplayedPage(page: Page): Promise<number> {
    // Wait for URL to update (useShallowUrl has 300ms debounce)
    await page.waitForTimeout(500);
    const url = page.url();
    const match = url.match(/\/p\/(\d+)(?:\/|$|\?)/);
    if (match) return Number.parseInt(match[1], 10);
    // Fallback: read from the page indicator button
    const text = await page
        .locator("button")
        .filter({ hasText: /^\d+$/ })
        .first()
        .textContent({ timeout: 3000 })
        .catch(() => "0");
    return Number.parseInt(text?.trim() ?? "0", 10);
}

/**
 * Simulate a forward swipe (next page) via the CSS scroll-snap path:
 * set scrollLeft = 0 (slot 0 = currentPage+1) and fire scrollend.
 */
async function swipeForward(page: Page) {
    await page.evaluate(() => {
        const c = document.querySelector(".swipe-container") as HTMLElement;
        if (!c) throw new Error("Swipe container not found");
        c.scrollLeft = 0;
        c.dispatchEvent(new Event("scrollend", { bubbles: false }));
    });
}

/**
 * Simulate a backward swipe (prev page):
 * set scrollLeft = 2W (slot 2 = currentPage-1) and fire scrollend.
 */
async function swipeBackward(page: Page) {
    await page.evaluate(() => {
        const c = document.querySelector(".swipe-container") as HTMLElement;
        if (!c) throw new Error("Swipe container not found");
        c.scrollLeft = c.clientWidth * 2;
        c.dispatchEvent(new Event("scrollend", { bubbles: false }));
    });
}

/** Assert displayed page equals expected. */
async function assertPage(page: Page, expected: number, label: string) {
    const actual = await getDisplayedPage(page);
    expect(actual, `${label}: expected page ${expected}`).toBe(expected);
}

// ---------------------------------------------------------------------------
// 1. Direct navigation + swipe
// ---------------------------------------------------------------------------
test.describe("Swipe from direct URL navigation", () => {
    test("navigate to page 5, swipe forward, verify page 6", async ({ page }) => {
        await page.goto("/p/5");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(5);

        await swipeForward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 6, "swipe-forward-from-5");
    });

    test("navigate to page 10, swipe backward, verify page 9", async ({ page }) => {
        await page.goto("/p/10");
        await waitForMushafRender(page);

        const initial = await getDisplayedPage(page);
        expect(initial).toBe(10);

        await swipeBackward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 9, "swipe-backward-from-10");
    });

    test("navigate to page 1, swipe forward twice, verify page 3", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);
        expect(await getDisplayedPage(page)).toBe(1);

        await swipeForward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 2, "first-swipe-from-1");

        await swipeForward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 3, "second-swipe-from-1");
    });
});

// ---------------------------------------------------------------------------
// 2. Jump via Navigation Picker, then swipe
// ---------------------------------------------------------------------------
test.describe("Swipe after Navigation Picker jump", () => {
    test("jump to Al-Baqarah page 2, then swipe forward", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);

        await page.evaluate(() =>
            (window as unknown as { __showChrome?: () => void }).__showChrome?.()
        );
        await page.waitForTimeout(500);

        const navButton = page.locator("button").filter({ hasText: /^\d+$/ });
        await navButton.first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(500);

        const sheet = page.locator(".fixed.inset-x-0.bottom-0");
        const surahButton = sheet.locator("button").filter({ hasText: /Al-Baqarah/i }).first();
        await surahButton.click();
        await page.waitForTimeout(300);

        const goButton = sheet.locator("button").filter({ hasText: /^Go to / }).first();
        await goButton.click({ timeout: 5000 });
        await page.waitForTimeout(500);

        await waitForMushafRender(page);
        const jumpedPage = await getDisplayedPage(page);
        expect(jumpedPage).toBeGreaterThanOrEqual(2);

        await swipeForward(page);
        await page.waitForTimeout(500);
        await assertPage(page, jumpedPage + 1, `swipe-after-jump-${jumpedPage}`);
    });
});

// ---------------------------------------------------------------------------
// 3. Chained swipes — stress test
// ---------------------------------------------------------------------------
test.describe("Chained swipes and navigation jumps", () => {
    test("multiple forward swipes in sequence", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);

        let expected = 1;
        for (let i = 0; i < 5; i++) {
            await swipeForward(page);
            await page.waitForTimeout(500);
            expected++;
            await assertPage(page, expected, `chain-swipe-${i}`);
        }
    });

    test("alternating forward and backward swipes", async ({ page }) => {
        await page.goto("/p/5");
        await waitForMushafRender(page);

        await swipeForward(page);  await page.waitForTimeout(500);
        await assertPage(page, 6, "alt-1-forward");

        await swipeForward(page);  await page.waitForTimeout(500);
        await assertPage(page, 7, "alt-2-forward");

        await swipeBackward(page); await page.waitForTimeout(500);
        await assertPage(page, 6, "alt-3-backward");

        await swipeForward(page);  await page.waitForTimeout(500);
        await assertPage(page, 7, "alt-4-forward");

        await swipeBackward(page); await page.waitForTimeout(500);
        await assertPage(page, 6, "alt-5-backward");

        await swipeBackward(page); await page.waitForTimeout(500);
        await assertPage(page, 5, "alt-6-backward-final");
    });

    test("keyboard jump then swipe then keyboard", async ({ page }) => {
        await page.goto("/p/3");
        await waitForMushafRender(page);
        await assertPage(page, 3, "start");

        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(500);
        await assertPage(page, 4, "keyboard-forward");

        await swipeForward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 5, "swipe-after-keyboard");

        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(500);
        await assertPage(page, 4, "keyboard-backward");

        await swipeBackward(page);
        await page.waitForTimeout(500);
        await assertPage(page, 3, "swipe-backward-after-keyboard");
    });

    test("rapid consecutive swipes don't break state", async ({ page }) => {
        await page.goto("/p/5");
        await waitForMushafRender(page);
        await assertPage(page, 5, "start");

        // Each swipe waits for React to settle before the next
        await swipeForward(page); await page.waitForTimeout(500);
        await swipeForward(page); await page.waitForTimeout(500);
        await swipeForward(page); await page.waitForTimeout(500);

        const settled = await getDisplayedPage(page);
        expect(settled).toBeGreaterThan(5);
        expect(settled).toBeLessThanOrEqual(8);

        // Must remain stable
        await page.waitForTimeout(500);
        const stillSettled = await getDisplayedPage(page);
        expect(stillSettled).toBe(settled);
    });
});

// ---------------------------------------------------------------------------
// 4. Random page swipe stability
// ---------------------------------------------------------------------------
test.describe("Random page swipe stability", () => {
    const testPages = [50, 100, 200, 300, 400, 500];

    for (const startPage of testPages) {
        test(`page ${startPage}: swipe forward and verify stability`, async ({ page }) => {
            await page.goto(`/p/${startPage}`);
            await waitForMushafRender(page);
            expect(await getDisplayedPage(page)).toBe(startPage);

            await swipeForward(page);
            await page.waitForTimeout(500);
            await assertPage(page, startPage + 1, `random-${startPage}`);
        });
    }
});

// ---------------------------------------------------------------------------
// 5. Partial swipe / peek-and-back
// ---------------------------------------------------------------------------
test.describe("Partial Swipes", () => {
    test("peek-and-back does not trigger premature page change", async ({ page }) => {
        await page.goto("/p/1");
        await waitForMushafRender(page);
        await assertPage(page, 1, "start");

        // Simulate: user drags right, then drags back — browser snaps to center
        await page.evaluate(() => {
            const c = document.querySelector(".swipe-container") as HTMLElement;
            if (!c) throw new Error("Swipe container not found");
            c.scrollLeft = c.clientWidth; // center = current page, no page change
            c.dispatchEvent(new Event("scrollend", { bubbles: false }));
        });

        await page.waitForTimeout(500);
        await assertPage(page, 1, "after-peek-and-back");
    });
});
