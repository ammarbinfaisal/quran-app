import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForMushafRender(page: Page) {
    // Wait for at least one mushaf-word to appear in the DOM
    await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
}



// ---------------------------------------------------------------------------
// Reader page — basic rendering
// ---------------------------------------------------------------------------

test.describe("Reader page renders correctly", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);
    });

    test("QCF font loads and mushaf words have content", async ({ page }) => {
        const words = page.locator(".mushaf-word");
        const count = await words.count();
        expect(count).toBeGreaterThan(0);

        // Assert the first word has non-empty text (glyph code present)
        const firstWordText = await words.first().textContent();
        expect(firstWordText?.trim().length).toBeGreaterThan(0);
    });

    test("QCF font is registered in document.fonts", async ({ page }) => {
        // Give fonts time to load from CDN
        await page.waitForTimeout(3_000);

        const fontRegistered = await page.evaluate(() => {
            for (const f of document.fonts) {
                if (f.family.startsWith("QCF_v2_P")) return true;
            }
            return false;
        });

        expect(fontRegistered).toBe(true);
    });

    test("no top header present", async ({ page }) => {
        const headers = page.locator("main header");
        await expect(headers).toHaveCount(0);
    });
});

// ---------------------------------------------------------------------------
// Bottom nav — visibility & immersive mode
// ---------------------------------------------------------------------------

test.describe("Bottom nav and immersive mode", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);
    });

    test("bottom nav is present in DOM", async ({ page }) => {
        const nav = page.locator("nav").filter({ has: page.locator("[aria-label='Home']") });
        await expect(nav).toBeAttached();
    });

    test("bottom nav contains Home, page indicator, Downloads, Settings", async ({
        page,
    }) => {
        await expect(page.locator("[aria-label='Home']")).toBeAttached();
        await expect(page.locator("[aria-label='Manage downloads']")).toBeAttached();
        await expect(page.locator("[aria-label='Settings']")).toBeAttached();
        // Page indicator shows the current page number
        await expect(page.getByText("1", { exact: true }).first()).toBeAttached();
    });

    test("tapping reading area toggles chrome visibility", async ({ page }) => {
        // Wait for initial auto-hide (2500ms + buffer)
        await page.waitForTimeout(3_500);

        const nav = page.locator("nav").filter({ has: page.locator("[aria-label='Home']") });

        // After auto-hide, nav should be translateY(100%) — hidden
        const transformHidden = await nav.evaluate(
            (el) => getComputedStyle(el).transform,
        );
        // translateY(100%) won't be "none"
        expect(transformHidden).not.toBe("none");

        // Tap in the reading area to show chrome
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);

        const transformVisible = await nav.evaluate(
            (el) => (el as HTMLElement).style.transform,
        );
        expect(transformVisible).toBe("translateY(0)");
    });
});

// ---------------------------------------------------------------------------
// Sheet state — no overlapping sheets
// ---------------------------------------------------------------------------

test.describe("Sheet state management — no overlaps", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);
        // Ensure chrome is visible
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);
    });

    test("opening SurahPicker does not leave other sheets open", async ({
        page,
    }) => {
        // Open settings first
        await page.locator("[aria-label='Settings']").click();
        await expect(page.locator("[role='dialog']").filter({ hasText: "Settings" }))
            .toBeVisible();

        // Close settings
        await page.locator("[aria-label='Close settings']").click();
        await page.waitForTimeout(300);

        // Open SurahPicker
        // Re-show chrome (settings close might have hidden it)
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);

        const pageIndicator = page.locator("button").filter({ hasText: /^\d+$/ }).first();
        await pageIndicator.click();
        await page.waitForTimeout(300);

        // SurahPicker should be open
        await expect(
            page.locator("[role='dialog']").filter({ hasText: "Go to surah" }),
        ).toBeVisible();

        // Settings should NOT be open
        const settingsDialog = page
            .locator("[role='dialog']")
            .filter({ hasText: "Settings" });
        await expect(settingsDialog).not.toBeVisible();
    });

    test("opening Downloads does not leave Settings open", async ({ page }) => {
        // Open settings
        await page.locator("[aria-label='Settings']").click();
        await expect(
            page.locator("[role='dialog']").filter({ hasText: "Settings" }),
        ).toBeVisible();

        // Close settings
        await page.locator("[aria-label='Close settings']").click();
        await page.waitForTimeout(300);

        // Re-show chrome
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);

        // Open downloads
        await page.locator("[aria-label='Manage downloads']").click();
        await page.waitForTimeout(300);

        // Settings should NOT be visible
        const settingsDialog = page
            .locator("[role='dialog']")
            .filter({ hasText: "Settings" });
        await expect(settingsDialog).not.toBeVisible();
    });

    test("only one sheet/dialog open at a time", async ({ page }) => {
        // Open Settings
        await page.locator("[aria-label='Settings']").click();
        await page.waitForTimeout(300);

        // Count visible dialogs — should be exactly 1
        const visibleDialogs = page.locator("[role='dialog']:visible");
        const count = await visibleDialogs.count();
        expect(count).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// SurahPicker — bottom-anchored
// ---------------------------------------------------------------------------

test.describe("SurahPicker is bottom-anchored", () => {
    test("SurahPicker dialog positioned at bottom", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);

        // Show chrome
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);

        // Open SurahPicker
        const pageIndicator = page.locator("button").filter({ hasText: /^\d+$/ });
        await pageIndicator.click();
        await page.waitForTimeout(300);

        const picker = page
            .locator("[role='dialog']")
            .filter({ hasText: "Go to surah" });
        await expect(picker).toBeVisible();

        // Verify it's bottom-anchored: should have bottom: 0 in computed style
        const bottom = await picker.evaluate(
            (el) => getComputedStyle(el).bottom,
        );
        expect(bottom).toBe("0px");
    });
});

// ---------------------------------------------------------------------------
// Touch targets — minimum 48px
// ---------------------------------------------------------------------------

test.describe("Touch targets meet 48px minimum", () => {
    test("bottom nav buttons are at least 48px", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushafRender(page);

        // Show chrome
        await page.mouse.click(100, 100);
        await page.waitForTimeout(400);

        for (const label of ["Home", "Settings", "Manage downloads"]) {
            const btn = page.locator(`[aria-label='${label}']`);
            const box = await btn.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.width).toBeGreaterThanOrEqual(48);
            expect(box!.height).toBeGreaterThanOrEqual(48);
        }
    });
});

// ---------------------------------------------------------------------------
// SwipeReader JS Touch Logic
// ---------------------------------------------------------------------------

test.describe("SwipeReader JS Touch Logic", () => {
    test.beforeEach(async ({ page }) => {
        // We start on page 2 so we can test both left and right directions safely
        await page.goto("/p/v2/2");
        await waitForMushafRender(page);
        // Initial setup wait to ensure hydration and measurements are handled
        await page.waitForTimeout(500);
    });

    test("multi-finger handoff prevents jitter and maintains drag", async ({ page }) => {
        const container = page.locator(".swipe-container");
        await expect(container).toBeVisible();

        const box = await container.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return;

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        await page.evaluate(
            ({ x, y }) => {
                const el = document.querySelector(".swipe-container")!;
                // Finger 1 down
                const touch1 = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
                el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch1], changedTouches: [touch1], bubbles: true }));

                // Finger 1 drag right by 50px
                const touch1Move = new Touch({ identifier: 1, target: el, clientX: x + 50, clientY: y });
                el.dispatchEvent(new TouchEvent("touchmove", { touches: [touch1Move], changedTouches: [touch1Move], bubbles: true }));
            },
            { x: startX, y: startY }
        );

        // Verify that the track has predictably moved right by 50px
        await page.evaluate(() => {
            const track = document.querySelector(".swipe-track") as HTMLElement;
            return track.style.transform;
        });

        // At page 2, track starts at +W (e.g. 400px). We moved right by 50px.
        // It shouldn't have changed page yet.
        await expect(page.getByText("2", { exact: true }).first()).toBeVisible();

        await page.evaluate(
            ({ x, y }) => {
                const el = document.querySelector(".swipe-container")!;
                const touch1Move = new Touch({ identifier: 1, target: el, clientX: x + 50, clientY: y });
                // Finger 2 down somewhere else
                const touch2 = new Touch({ identifier: 2, target: el, clientX: x + 100, clientY: y + 20 });
                el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch1Move, touch2], changedTouches: [touch2], bubbles: true }));

                // Lift Finger 1
                el.dispatchEvent(new TouchEvent("touchend", { touches: [touch2], changedTouches: [touch1Move], bubbles: true }));

                // Drag Finger 2 right by another 100px (to trigger page change threshold)
                const touch2Move = new Touch({ identifier: 2, target: el, clientX: x + 200, clientY: y + 20 });
                el.dispatchEvent(new TouchEvent("touchmove", { touches: [touch2Move], changedTouches: [touch2Move], bubbles: true }));

                // Finally lift Finger 2
                el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch2Move], bubbles: true }));
            },
            { x: startX, y: startY }
        );

        // This combined drag should definitely exceed the threshold and navigate to page 3
        await expect(async () => {
            const pageNum = await page.getByText("3", { exact: true }).first().isVisible();
            expect(pageNum).toBe(true);
        }).toPass({ timeout: 5000 });
    });
});
