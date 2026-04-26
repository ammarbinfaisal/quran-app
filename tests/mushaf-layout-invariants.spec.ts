/**
 * Mushaf layout invariants — geometric contract enforced across pages + viewports.
 *
 * The mushaf reader's appearance derives from a small set of calibrated factors:
 *
 *   --mushaf-page-width   = 95vw
 *   --mushaf-line-width   = 0.95 × pageWidth         (5% gutter total)
 *   --mushaf-base-size    = lineWidth / 17.6         (font undersized vs natural-fit 16.32)
 *   slot height           = 0.108 × pageWidth        (15 stacked = ink-area aspect ~1.71)
 *   slot / font           ≈ 2.0                      (50% ink, 50% leading per line)
 *   .mushaf-line          = display: flex; justify-content: space-between
 *   gutter                = uniform (padding-block === padding-inline)
 *
 * If any of those drifts (someone tunes a number without understanding the
 * cascade), the visual spec breaks: lines clump, leading vanishes, page
 * compresses, or words clip. This spec catches that drift before merge.
 *
 * Each test runs at multiple viewport sizes — many invariants involve dividing
 * one rendered length by another, so they should be size-independent.
 *
 * NOTE on lineWidth: .mushaf-page has box-sizing: border-box + a 1px decorative
 * border, so the line element's actual rendered width is clamped to the page's
 * content-box (pageWidth - 2×padding - 2×border), which is approximately but
 * not exactly 0.95 × pageWidth. The test asserts the rendered line fills the
 * content-box exactly; the 0.95 factor enters via the CSS padding formula.
 *
 * Justified-flush + glyph-ink-overflow are NOT covered here — they live in
 * tests/mushaf-line-boundaries.spec.ts which iterates all 604 pages.
 */

import { test, expect, type Page } from "@playwright/test";

const SPEC = {
    pageWidthOfViewport: 0.95,           // --mushaf-page-width = 95vw
    lineWidthOfPage: 0.95,               // --mushaf-line-width = 0.95 × pageWidth (target before border clamp)
    fontDivisor: 17.6,                    // --mushaf-base-size = lineWidth / 17.6
    slotHeightOfPage: 0.108,              // slot height = 0.108 × pageWidth
    slotToFontRatio: 2.0,                 // slot height / font = 2.0
    linesPerPage: 15,                     // hardcoded mushaf line count
    inkAreaAspect: 0.108 * 15 / 0.95,     // ≈ 1.705  (15 slots stacked / line width)
} as const;

const TOL = {
    relPct: 0.015,       // 1.5% slack on length ratios (allows for the 1px border clamp)
    fontRelPct: 0.02,    // 2% on font-size formula (line clamped to content-box drifts the calc)
    slotFontRel: 0.05,   // ±5% on slot/font ratio (em rounding)
    aspectRelPct: 0.02,  // 2% on aspect ratio (footer + page-number adds noise)
    paddingPx: 1,        // padding-block === padding-inline within 1px
} as const;

const SAMPLE_PAGES = [3, 100, 254, 400, 600] as const;

type Viewport = { name: string; width: number; height: number };
const VIEWPORTS: Viewport[] = [
    { name: "iphone-portrait", width: 390, height: 844 },
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
];

type LayoutMeasurement = {
    viewport: { vw: number; vh: number };
    pageWidthPx: number;
    pageContentBoxWidthPx: number;
    lineWidthPx: number;
    fontPx: number;
    slotHeightPx: number;
    slotCount: number;
    lineDisplay: string;
    lineJustify: string;
    lineIsCentered: boolean;
    paddingTopPx: number;
    paddingLeftPx: number;
    borderLeftPx: number;
    inkBlockHeightPx: number;
    inkBlockWidthPx: number;
};

async function readerReady(page: Page) {
    await page.waitForSelector(".mushaf-page", { timeout: 20_000 });
    await page.waitForFunction(
        () => {
            const lines = document.querySelectorAll(".mushaf-line");
            if (lines.length === 0) return false;
            for (const l of Array.from(lines))
                if (l.querySelectorAll(".mushaf-word").length === 0) return false;
            return true;
        },
        { timeout: 30_000 }
    );
    await page.waitForTimeout(80);
}

async function measure(page: Page): Promise<LayoutMeasurement> {
    return await page.evaluate(() => {
        const pageEl = document.querySelector<HTMLElement>(".mushaf-page");
        if (!pageEl) throw new Error("no .mushaf-page");
        // Use the first NON-centered line for justify/font assertions —
        // .mushaf-line-centered overrides justify-content to "center" so it
        // would fail the space-between check, and centered lines are short
        // (don't fill the line width). Pages like p3 (Alif Lam Mim opening)
        // start with several centered lines.
        const allLines = Array.from(pageEl.querySelectorAll<HTMLElement>(".mushaf-line"));
        const lineEl =
            allLines.find((l) => !l.classList.contains("mushaf-line-centered")) ??
            allLines[0];
        if (!lineEl) throw new Error("no .mushaf-line on page");
        const lineIsCentered = lineEl.classList.contains("mushaf-line-centered");

        const slots = Array.from(
            pageEl.querySelectorAll<HTMLElement>(":scope > div")
        ).filter((d) => !d.classList.contains("page-number"));

        const pageRect = pageEl.getBoundingClientRect();
        const lineRect = lineEl.getBoundingClientRect();
        const pageStyle = getComputedStyle(pageEl);
        const lineStyle = getComputedStyle(lineEl);

        const padL = parseFloat(pageStyle.paddingLeft);
        const padR = parseFloat(pageStyle.paddingRight);
        const borL = parseFloat(pageStyle.borderLeftWidth);
        const borR = parseFloat(pageStyle.borderRightWidth);
        const pageContentBoxWidth = pageRect.width - padL - padR - borL - borR;

        // Ink block = ALL 15 stacked slots, not just slots with content.
        // Pages where a surah ends partway (e.g. start of Al-Baqarah on p3,
        // end of Al-Fatihah on p1) have empty filler slots that still count
        // toward the page's geometric ink-area; the ink-area aspect should
        // be ~1.71 regardless of how many slots happen to carry text today.
        const firstSlot = slots[0]?.getBoundingClientRect();
        const lastSlot = slots[slots.length - 1]?.getBoundingClientRect();
        const inkBlockHeight = firstSlot && lastSlot ? lastSlot.bottom - firstSlot.top : 0;
        const inkBlockWidth = firstSlot ? firstSlot.width : 0;

        return {
            viewport: { vw: window.innerWidth, vh: window.innerHeight },
            pageWidthPx: pageRect.width,
            pageContentBoxWidthPx: pageContentBoxWidth,
            lineWidthPx: lineRect.width,
            fontPx: parseFloat(lineStyle.fontSize),
            slotHeightPx: slots[0].getBoundingClientRect().height,
            slotCount: slots.length,
            lineDisplay: lineStyle.display,
            lineJustify: lineStyle.justifyContent,
            lineIsCentered,
            paddingTopPx: parseFloat(pageStyle.paddingTop),
            paddingLeftPx: padL,
            borderLeftPx: borL,
            inkBlockHeightPx: inkBlockHeight,
            inkBlockWidthPx: inkBlockWidth,
        };
    });
}

function approxEqualRel(actual: number, expected: number, relTolerance: number) {
    if (expected === 0) return Math.abs(actual) < 0.01;
    return Math.abs(actual - expected) / Math.abs(expected) <= relTolerance;
}

test.describe.configure({ mode: "parallel" });

test.describe("Mushaf layout invariants", () => {
    for (const vp of VIEWPORTS) {
        test.describe(`@ ${vp.name} ${vp.width}×${vp.height}`, () => {
            test.use({ viewport: { width: vp.width, height: vp.height } });

            for (const pageNum of SAMPLE_PAGES) {
                test(`p${pageNum}: geometric contract holds`, async ({ page }) => {
                    await page.goto(`/p/${pageNum}`, { waitUntil: "domcontentloaded" });
                    await readerReady(page);
                    const m = await measure(page);

                    // (1) line is flexbox; the JUSTIFICATION mechanism is space-between
                    //     for normal lines, center for the .mushaf-line-centered override
                    //     (bismillah, surah-opener, end-of-surah short ayah). On pages
                    //     where every line happens to be centered (rare, e.g. p3 surah
                    //     opening), only the flex display invariant can be checked.
                    expect(m.lineDisplay, "line display").toBe("flex");
                    if (!m.lineIsCentered) {
                        expect(m.lineJustify, "non-centered line justify-content").toBe("space-between");
                    } else {
                        expect(m.lineJustify, "centered line justify-content").toBe("center");
                    }

                    // (2) page width = 95% of viewport width (within 1.5%).
                    const expectedPageW = m.viewport.vw * SPEC.pageWidthOfViewport;
                    expect(
                        approxEqualRel(m.pageWidthPx, expectedPageW, TOL.relPct),
                        `pageWidth ${m.pageWidthPx.toFixed(1)} vs expected ${expectedPageW.toFixed(1)} (95% of vw ${m.viewport.vw})`
                    ).toBe(true);

                    // (3) line fills the page content-box exactly. The CSS sets
                    //     --mushaf-line-width to 0.95 × pageWidth, but border-box
                    //     + 1px decorative border means the rendered line is the
                    //     content-box width. Either way: line === content-box.
                    expect(
                        Math.abs(m.lineWidthPx - m.pageContentBoxWidthPx) <= 1,
                        `lineWidth ${m.lineWidthPx.toFixed(2)} should equal page content-box width ${m.pageContentBoxWidthPx.toFixed(2)} (within 1px)`
                    ).toBe(true);

                    // (4) line width is approximately 0.95 × pageWidth (the design intent
                    //     of the gutter). Allows the 1-2px border clamp.
                    const expectedLineW = m.pageWidthPx * SPEC.lineWidthOfPage;
                    expect(
                        approxEqualRel(m.lineWidthPx, expectedLineW, TOL.relPct),
                        `lineWidth ${m.lineWidthPx.toFixed(1)} vs expected ${expectedLineW.toFixed(1)} (0.95 × pageWidth)`
                    ).toBe(true);

                    // (5) font-size = lineWidth / 17.6. The calibrated divisor.
                    //     If anyone bumps it without recomputing slot height, slot/font
                    //     drifts and breaks the 50/50 ink/leading invariant.
                    const expectedFont = m.lineWidthPx / SPEC.fontDivisor;
                    expect(
                        approxEqualRel(m.fontPx, expectedFont, TOL.fontRelPct),
                        `fontPx ${m.fontPx.toFixed(2)} vs expected ${expectedFont.toFixed(2)} (lineWidth / 17.6)`
                    ).toBe(true);

                    // (6) slot height = 0.108 × pageWidth. Coupled to (5) to give 2.0 slot/font.
                    const expectedSlotH = m.pageWidthPx * SPEC.slotHeightOfPage;
                    expect(
                        approxEqualRel(m.slotHeightPx, expectedSlotH, TOL.relPct),
                        `slotHeight ${m.slotHeightPx.toFixed(1)} vs expected ${expectedSlotH.toFixed(1)} (0.108 × pageWidth)`
                    ).toBe(true);

                    // (7) slot/font ≈ 2.0 (the user-visible "half ink, half leading" property).
                    const slotToFont = m.slotHeightPx / m.fontPx;
                    expect(
                        Math.abs(slotToFont - SPEC.slotToFontRatio) <= TOL.slotFontRel,
                        `slot/font ratio ${slotToFont.toFixed(3)} vs expected ${SPEC.slotToFontRatio} (±${TOL.slotFontRel})`
                    ).toBe(true);

                    // (8) ink-area aspect (15 slots tall / line wide) ≈ 1.71.
                    if (m.inkBlockWidthPx > 0 && m.inkBlockHeightPx > 0) {
                        const aspect = m.inkBlockHeightPx / m.inkBlockWidthPx;
                        expect(
                            approxEqualRel(aspect, SPEC.inkAreaAspect, TOL.aspectRelPct),
                            `ink-area aspect ${aspect.toFixed(3)} vs expected ${SPEC.inkAreaAspect.toFixed(3)} (15 slots / line width)`
                        ).toBe(true);
                    }

                    // (9) page renders with 15 line slots. Hardcoded LINES_PER_PAGE,
                    //     load-bearing for the slot-height formula and the page aspect.
                    expect(m.slotCount, `slot count`).toBe(SPEC.linesPerPage);

                    // (10) gutter is uniform (padding-block === padding-inline).
                    //      If they diverge, the page no longer reads as a printed-mushaf
                    //      page with a single uniform inner margin.
                    expect(
                        Math.abs(m.paddingTopPx - m.paddingLeftPx) <= TOL.paddingPx,
                        `padding-top ${m.paddingTopPx.toFixed(2)} vs padding-left ${m.paddingLeftPx.toFixed(2)} (must be uniform)`
                    ).toBe(true);
                });
            }
        });
    }
});
