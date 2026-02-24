import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate a completed forward swipe (next page).
 * Sets scrollLeft to 0 (slot 0 = currentPage+1) and fires scrollend —
 * exactly what the browser does after the snap animation settles.
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
 * Simulate a completed backward swipe (prev page).
 * Sets scrollLeft to 2W (slot 2 = currentPage-1) and fires scrollend.
 */
async function swipeBackward(page: Page) {
    await page.evaluate(() => {
        const c = document.querySelector(".swipe-container") as HTMLElement;
        if (!c) throw new Error("Swipe container not found");
        c.scrollLeft = c.clientWidth * 2;
        c.dispatchEvent(new Event("scrollend", { bubbles: false }));
    });
}

/**
 * Simulate a peek-and-drag-back: browser snaps back to center (W), no page change.
 */
async function swipePeekAndBack(page: Page) {
    await page.evaluate(() => {
        const c = document.querySelector(".swipe-container") as HTMLElement;
        if (!c) throw new Error("Swipe container not found");
        c.scrollLeft = c.clientWidth; // center = current page
        c.dispatchEvent(new Event("scrollend", { bubbles: false }));
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("CSS scroll-snap SwipeReader", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/p/10");
        await page.waitForSelector(".swipe-container");
        await page.waitForSelector(".swipe-track");
        await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
    });

    test("Peek then drag back stays on same page", async ({ page }) => {
        // User drags right ~30%, then drags back past origin.
        // Browser snaps to center — scrollend fires at W → no page change.
        await swipePeekAndBack(page);
        await page.waitForTimeout(300);
        await expect(page).toHaveURL(/\/p\/10(?:\?|$)/);
    });

    test("Small quick swipe turns page forward", async ({ page }) => {
        // Any snap to slot 0 counts as next page regardless of drag distance/speed.
        await swipeForward(page);
        await page.waitForTimeout(400);
        await expect(page).toHaveURL(/\/p\/11(?:\?|$)/);
    });

    test("Long drag turns page forward", async ({ page }) => {
        // 60%+ drag → slot 0 → next page (same path as fast flick).
        await swipeForward(page);
        await page.waitForTimeout(400);
        await expect(page).toHaveURL(/\/p\/11(?:\?|$)/);
    });

    test("Drag left turns page backward", async ({ page }) => {
        // Snap to slot 2 (scrollLeft = 2W) → prev page.
        await swipeBackward(page);
        await page.waitForTimeout(400);
        await expect(page).toHaveURL(/\/p\/9(?:\?|$)/);
    });
});
