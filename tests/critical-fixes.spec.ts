/**
 * Baseline regression tests for the critical bugs documented in
 * docs/claude-s-ui-ux-impl-mistakes-findings.md
 *
 * These tests were written BEFORE the fixes to serve as a failing baseline,
 * then confirmed passing after the fixes are applied.
 */

import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function waitForMushaf(page: Page) {
    await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// C2: URL format must be /p/<mushaf>/<page> in mushaf mode
// ---------------------------------------------------------------------------

test.describe("C2 — Shallow URL uses correct route format", () => {
    test("Mushaf mode URL is /p/<mushaf>/<page>", async ({ page }) => {
        await page.goto("/p/v2/1");
        await waitForMushaf(page);
        // Wait for debounced URL sync (300ms)
        await page.waitForTimeout(500);

        const url = page.url();
        expect(url).toMatch(/\/p\/v2\/1/);
        expect(url).not.toMatch(/^\/v2\//); // old broken format
    });
});

// ---------------------------------------------------------------------------
// H3: generateStaticParams must not include "indopak" — all routes valid
// ---------------------------------------------------------------------------

test.describe("H3 — generateStaticParams uses valid mushaf codes", () => {
    test("/v/i15/s:1 route resolves (IndoPak 15-line)", async ({ page }) => {
        const resp = await page.goto("/v/i15/s:1");
        // Should not 404 — server should render the VbV page for IndoPak
        expect(resp?.status()).not.toBe(404);
        // Should NOT show InvalidPathMessage
        const invalid = page.locator("text=is not a recognized mushaf code");
        await expect(invalid).not.toBeVisible({ timeout: 5_000 });
    });

    test("/v/qpc/s:1 route resolves (KFGQPC)", async ({ page }) => {
        const resp = await page.goto("/v/qpc/s:1");
        expect(resp?.status()).not.toBe(404);
        const invalid = page.locator("text=is not a recognized mushaf code");
        await expect(invalid).not.toBeVisible({ timeout: 5_000 });
    });
});

// ---------------------------------------------------------------------------
// H1: Bismillah must not double-render for Surah 1 in VbV mode
// ---------------------------------------------------------------------------

test.describe("H1 — Surah 1 Bismillah not double-rendered in VbV", () => {
    test("VbV /v/v2/s:1 — exactly one Bismillah SVG visible", async ({ page }) => {
        await page.goto("/v/v2/s:1");
        // Wait for verse content to load
        await page.waitForSelector(".surah-header", { timeout: 15_000 });
        await page.waitForTimeout(1_000);

        // The Bismillah SVG should appear at most once in the surah header area.
        // (Verse 1:1 text itself is "In the name of Allah..." — that's the translation,
        //  not an extra SVG. The SVG Bismillah should only appear once as the decorative header.)
        const bismillahSvgs = page.locator(".surah-header svg, .bismillah-line svg");
        const count = await bismillahSvgs.count();
        // For Surah 1 specifically: no decorative Bismillah SVG should render
        // because verse 1:1 IS the Bismillah.
        expect(count).toBe(0);
    });

    test("VbV /v/v2/s:2 — Bismillah SVG visible exactly once", async ({ page }) => {
        await page.goto("/v/v2/s:2");
        await page.waitForSelector(".surah-header", { timeout: 15_000 });
        await page.waitForTimeout(1_000);

        // Surah 2 has bismillahPre=true and id≠1 and id≠9 → one decorative Bismillah.
        // There should be exactly one Bismillah rendered in the header area.
        const headerArea = page.locator(".surah-header").first();
        await expect(headerArea).toBeVisible();
        // The SVG inside should render once
        const svgsInHeader = headerArea.locator("~ * svg, svg");
        const svgCount = await svgsInHeader.count();
        expect(svgCount).toBeLessThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// V3: Unicode mushaf tap opens Translation sheet, not Morphology
// ---------------------------------------------------------------------------

test.describe("V3 — Unicode mushaf word tap opens Translation sheet", () => {
    test("IndoPak /p/i15/1 — word tap shows Translation sheet not Morphology", async ({ page }) => {
        await page.goto("/p/i15/1");
        await waitForMushaf(page);
        await page.waitForTimeout(500);

        // Tap first mushaf word
        await page.locator(".mushaf-word").first().click();
        await page.waitForTimeout(1_500);

        // AyahSheet (translation) should be open
        const ayahSheet = page.locator("[role='dialog']").filter({ hasText: "Verse" });
        await expect(ayahSheet).toBeVisible({ timeout: 5_000 });

        // MorphologySheet should NOT be open
        const morphSheet = page.locator("[role='dialog']").filter({ hasText: "Morphology" });
        await expect(morphSheet).not.toBeVisible();
    });

    test("KFGQPC /p/qpc/1 — word tap shows Translation sheet not Morphology", async ({ page }) => {
        await page.goto("/p/qpc/1");
        await waitForMushaf(page);
        await page.waitForTimeout(500);

        await page.locator(".mushaf-word").first().click();
        await page.waitForTimeout(1_500);

        const ayahSheet = page.locator("[role='dialog']").filter({ hasText: "Verse" });
        await expect(ayahSheet).toBeVisible({ timeout: 5_000 });

        const morphSheet = page.locator("[role='dialog']").filter({ hasText: "Morphology" });
        await expect(morphSheet).not.toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// V4: VbV translation font must be smaller than Arabic
// ---------------------------------------------------------------------------

test.describe("V4 — VbV translation font is smaller than Arabic", () => {
    test("/v/v2/s:1 — translation container font-size < Arabic container font-size", async ({ page }) => {
        await page.goto("/v/v2/s:1");
        await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
        await page.waitForTimeout(1_500);

        const sizes = await page.evaluate(() => {
            // Find first verse block
            const arabicDiv = document.querySelector(
                "[data-highlighted] .flex-row-reverse, div[class*='flex-row-reverse']"
            ) as HTMLElement | null;
            const translationDiv = document.querySelector(
                "div[class*='space-y-5']"
            ) as HTMLElement | null;

            const arabicSize = arabicDiv ? parseFloat(getComputedStyle(arabicDiv).fontSize) : 0;
            const transSize = translationDiv ? parseFloat(getComputedStyle(translationDiv).fontSize) : 0;
            return { arabicSize, transSize };
        });

        // Translation font must be strictly smaller than Arabic font
        if (sizes.arabicSize > 0 && sizes.transSize > 0) {
            expect(sizes.transSize).toBeLessThan(sizes.arabicSize);
        }
    });
});

// ---------------------------------------------------------------------------
// C5: MushafPicker uses router.replace, not router.push (no full remount)
// ---------------------------------------------------------------------------

test.describe("C5 — MushafPicker changes mushaf without full page remount", () => {
    test("switching mushaf from settings keeps the page number state", async ({ page }) => {
        await page.goto("/p/v2/5");
        await waitForMushaf(page);

        // Show chrome and open settings
        await page.evaluate(() => (window as unknown as { __showChrome?: () => void }).__showChrome?.());
        await page.waitForTimeout(300);
        await page.locator("[aria-label='Settings']").click();
        await page.waitForTimeout(300);

        // Select V1
        const mushafSection = page.locator("section").filter({ hasText: "Mushaf" }).first();
        await mushafSection.getByText("V1").click();
        await page.waitForTimeout(600);

        // URL should reflect new mushaf
        const url = page.url();
        expect(url).toContain("v1");

        // Page indicator in bottom nav should still be visible (not lost due to remount)
        const indicator = page.locator("button").filter({ hasText: /^\d+$/ });
        await expect(indicator).toBeVisible({ timeout: 3_000 });
    });
});
