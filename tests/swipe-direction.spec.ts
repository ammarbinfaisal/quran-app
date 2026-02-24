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

async function dispatchSwipe(page: Page, startX: number, endX: number, y: number, durationMs: number) {
    await page.evaluate(({ startX, endX, y, durationMs }) => {
        const container = document.querySelector(".swipe-container") as HTMLElement;
        if (!container) throw new Error("Swipe container not found");

        const startTouch = new Touch({
            identifier: 1,
            target: container,
            clientX: startX,
            clientY: y,
            pageX: startX,
            pageY: y,
            screenX: startX,
            screenY: y,
        });

        container.dispatchEvent(new TouchEvent("touchstart", {
            cancelable: true,
            bubbles: true,
            touches: [startTouch],
            targetTouches: [startTouch],
            changedTouches: [startTouch],
        }));

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
                    clientY: y,
                    pageX: currentX,
                    pageY: y,
                    screenX: currentX,
                    screenY: y,
                });

                container.dispatchEvent(new TouchEvent("touchmove", {
                    cancelable: true,
                    bubbles: true,
                    touches: [moveTouch],
                    targetTouches: [moveTouch],
                    changedTouches: [moveTouch],
                }));

                if (currentStep >= steps) {
                    clearInterval(interval);
                    container.dispatchEvent(new TouchEvent("touchend", {
                        cancelable: true,
                        bubbles: true,
                        touches: [],
                        targetTouches: [],
                        changedTouches: [moveTouch],
                    }));
                    resolve();
                }
            }, stepDuration);
        });
    }, { startX, endX, y, durationMs });
}

async function getSwipeContainerRect(page: Page) {
    const container = page.locator(".swipe-container");
    await container.waitFor({ state: "attached" });

    for (let attempt = 0; attempt < 5; attempt++) {
        const rect = await container.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        if (rect.width > 0 && rect.height > 0) return rect;
        await page.waitForTimeout(50);
    }

    throw new Error("Swipe container not found");
}

/** Perform a swipe forward (next page). SwipeReader treats drag right as next page. */
async function swipeForward(page: Page) {
    const box = await getSwipeContainerRect(page);
    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.2;
    const endX = box.x + box.width * 0.8;
    await dispatchSwipe(page, startX, endX, y, 200);
}

/** Perform a swipe backward (previous page). */
async function swipeBackward(page: Page) {
    const box = await getSwipeContainerRect(page);
    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.8;
    const endX = box.x + box.width * 0.2;
    await dispatchSwipe(page, startX, endX, y, 200);
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
        await page.goto("/p/5");
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
        await page.goto("/p/10");
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
        await page.goto("/p/1");
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
        await page.goto("/p/1");
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
            await page.goto(`/p/${startPage}`);
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
        await page.goto("/p/1");
        await waitForMushafRender(page);
        await assertPage(page, 1, "start");

        const box = await page.locator(".swipe-container").boundingBox();
        if (!box) throw new Error("Could not find swipe container bounding box");

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        await page.evaluate(({ startX, startY }) => {
            const container = document.querySelector(".swipe-container") as HTMLElement;
            if (!container) throw new Error("Swipe container not found");

            const touchObj = new Touch({
                identifier: 7,
                target: container,
                clientX: startX,
                clientY: startY,
                pageX: startX,
                pageY: startY,
                screenX: startX,
                screenY: startY,
            });

            container.dispatchEvent(new TouchEvent("touchstart", {
                cancelable: true,
                bubbles: true,
                touches: [touchObj],
                targetTouches: [touchObj],
                changedTouches: [touchObj],
            }));

            const moveTouch = new Touch({
                identifier: 7,
                target: container,
                clientX: startX - 50,
                clientY: startY,
                pageX: startX - 50,
                pageY: startY,
                screenX: startX - 50,
                screenY: startY,
            });

            container.dispatchEvent(new TouchEvent("touchmove", {
                cancelable: true,
                bubbles: true,
                touches: [moveTouch],
                targetTouches: [moveTouch],
                changedTouches: [moveTouch],
            }));
        }, { startX, startY });

        // Hold for 300ms (to check if old 150ms timeout fires)
        await page.waitForTimeout(300);

        // Before releasing, page should still officially be 1
        await assertPage(page, 1, "during-partial-swipe");

        await page.evaluate(({ startX, startY }) => {
            const container = document.querySelector(".swipe-container") as HTMLElement;
            if (!container) throw new Error("Swipe container not found");

            const moveBack = new Touch({
                identifier: 7,
                target: container,
                clientX: startX,
                clientY: startY,
                pageX: startX,
                pageY: startY,
                screenX: startX,
                screenY: startY,
            });

            container.dispatchEvent(new TouchEvent("touchmove", {
                cancelable: true,
                bubbles: true,
                touches: [moveBack],
                targetTouches: [moveBack],
                changedTouches: [moveBack],
            }));

            container.dispatchEvent(new TouchEvent("touchend", {
                cancelable: true,
                bubbles: true,
                touches: [],
                targetTouches: [],
                changedTouches: [moveBack],
            }));
        }, { startX, startY });

        await page.waitForTimeout(500);

        // Page should remain 1
        await assertPageStable(page, 1, "after-aborted-swipe");
    });
});
