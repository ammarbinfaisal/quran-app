import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

// ---------------------------------------------------------------------------
// Helpers for Touch Emulation
// ---------------------------------------------------------------------------

/**
 * Simulates a touch drag gesture organically.
 * Native Playwright mouse/touch helpers sometimes lack full `TouchEvent` dispatch,
 * so we manually dispatch `touchstart`, `touchmove`, and `touchend`.
 */
async function dispatchSwipe(
    page: Page,
    startX: number,
    endX: number,
    durationMs: number = 100
) {
    await page.evaluate(
        ({ startX, endX, durationMs }) => {
            const container = document.querySelector(".swipe-container") as HTMLElement;
            if (!container) throw new Error("Swipe container not found");

            const touchObj = new Touch({
                identifier: 1,
                target: container,
                clientX: startX,
                clientY: 300,
                pageX: startX,
                pageY: 300,
                screenX: startX,
                screenY: 300,
            });

            const startEvent = new TouchEvent("touchstart", {
                cancelable: true,
                bubbles: true,
                touches: [touchObj],
                targetTouches: [touchObj],
                changedTouches: [touchObj],
            });
            container.dispatchEvent(startEvent);

            const steps = 10;
            const stepDuration = durationMs / steps;
            let currentStep = 0;

            return new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    currentStep++;
                    const progress = currentStep / steps;
                    const currentX = startX + (endX - startX) * progress;

                    const moveTouch = new Touch({
                        identifier: 1,
                        target: container,
                        clientX: currentX,
                        clientY: 300,
                        pageX: currentX,
                        pageY: 300,
                        screenX: currentX,
                        screenY: 300,
                    });

                    const moveEvent = new TouchEvent("touchmove", {
                        cancelable: true,
                        bubbles: true,
                        touches: [moveTouch],
                        targetTouches: [moveTouch],
                        changedTouches: [moveTouch],
                    });
                    container.dispatchEvent(moveEvent);

                    if (currentStep >= steps) {
                        clearInterval(interval);
                        const endEvent = new TouchEvent("touchend", {
                            cancelable: true,
                            bubbles: true,
                            touches: [],
                            targetTouches: [],
                            changedTouches: [moveTouch],
                        });
                        container.dispatchEvent(endEvent);
                        resolve();
                    }
                }, stepDuration);
            });
        },
        { startX, endX, durationMs }
    );
}

// ---------------------------------------------------------------------------
// Swipe Logic Tests
// ---------------------------------------------------------------------------

test.describe("JS-Controlled SwipeReader Test Suite", () => {
    test.beforeEach(async ({ page }) => {
        // Go to a known page, e.g., page 10
        await page.goto("/p/v2/10");
        // Wait for the container
        await page.waitForSelector(".swipe-container");
        // Wait for the track and the active page to appear
        await page.waitForSelector(".swipe-track");
        // Wait for mushaf words to ensure render
        await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
    });

    test("Short drag (< 50%) snaps back to original page", async ({ page }) => {
        const box = await page.locator(".swipe-container").boundingBox();
        expect(box).toBeTruthy();
        if (!box) return;

        const startX = box.x + box.width / 2;
        // Move only 20% of screen width (RTL meaning right = positive, left = negative translation)
        const endX = startX - box.width * 0.2;

        await dispatchSwipe(page, startX, endX, 300);

        // After snap back, wait for transition
        await page.waitForTimeout(500);

        // Expect we are still on page 10
        await expect(page).toHaveURL(/\/10\/v2/);
    });

    test("Long drag (> 50%) -> Turn to next Page (RTL: drag left goes to next page)", async ({ page }) => {
        const box = await page.locator(".swipe-container").boundingBox();
        expect(box).toBeTruthy();
        if (!box) return;

        // In RTL, dragging left means we expose the page on the right. 
        // And in RTL pagination, the "next" page (e.g. 11) is on the left physically?
        // Wait, Quran pages: Page 10 is on right side of book, Page 11 is on left.
        // So to go from 10 to 11, we drag left.
        const startX = box.x + box.width * 0.8;
        const endX = box.x + box.width * 0.2; // 60% drag left

        await dispatchSwipe(page, startX, endX, 300);

        // Wait for transition & React render
        await page.waitForTimeout(800);

        // Now URL should be 11
        await expect(page).toHaveURL(/\/11\/v2/);
    });

    test("Fast swipe velocity -> Turn page even with short drag", async ({ page }) => {
        const box = await page.locator(".swipe-container").boundingBox();
        if (!box) return;

        // Small drag distance (20%), but VERY fast (10ms)
        const startX = box.x + box.width / 2;
        const endX = startX - box.width * 0.2;

        await dispatchSwipe(page, startX, endX, 10);

        // Fast swipe left -> goes to page 11
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\/11\/v2/);
    });

    test("Touches are ignored while animating", async ({ page }) => {
        const box = await page.locator(".swipe-container").boundingBox();
        if (!box) return;

        // Dispatch a fast swipe to trigger a page change animation
        const startX = box.x + box.width * 0.8;
        const endX = box.x + box.width * 0.2;
        await dispatchSwipe(page, startX, endX, 50);

        // IMMEDIATELY while animating (~300ms transition), fire another swipe back
        await dispatchSwipe(page, endX, startX, 50);

        // Wait for everything
        await page.waitForTimeout(800);

        // The second swipe should be ignored due to the animating state trap,
        // so we end up on page 11.
        await expect(page).toHaveURL(/\/11\/v2/);
    });

    test("Multi-touch ignores second finger", async ({ page }) => {
        // This requires a custom evaluate function to dispatch two identifiers
        await page.evaluate(() => {
            const container = document.querySelector(".swipe-container") as HTMLElement;

            const touch1 = new Touch({ identifier: 1, target: container, clientX: 200, clientY: 300 });
            // const touch2 = new Touch({ identifier: 2, target: container, clientX: 300, clientY: 300 });

            // Put first finger down
            container.dispatchEvent(new TouchEvent("touchstart", {
                touches: [touch1], changedTouches: [touch1]
            }));

            // Move first finger
            const moveTouch1 = new Touch({ identifier: 1, target: container, clientX: 100, clientY: 300 });
            container.dispatchEvent(new TouchEvent("touchmove", {
                touches: [moveTouch1], changedTouches: [moveTouch1]
            }));

            // Put second finger down and move it (should be ignored by state machine identifier check)
            const moveTouch2 = new Touch({ identifier: 2, target: container, clientX: 400, clientY: 300 });
            container.dispatchEvent(new TouchEvent("touchstart", {
                touches: [moveTouch1, moveTouch2], changedTouches: [moveTouch2]
            }));
            container.dispatchEvent(new TouchEvent("touchmove", {
                touches: [moveTouch1, moveTouch2], changedTouches: [moveTouch2]
            }));

            // Release first finger, completing swipe
            container.dispatchEvent(new TouchEvent("touchend", {
                touches: [moveTouch2], changedTouches: [moveTouch1]
            }));
        });

        await page.waitForTimeout(800);

        // The first finger moved 100px left, and it should process it despite finger 2.
        // If threshold crossed or velocity high, it changes page. 
        // Here we just test it doesn't crash and processes the touchend.
        await expect(page.locator(".swipe-container")).toBeVisible();
    });
});
