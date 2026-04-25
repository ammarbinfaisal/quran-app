import { test, expect, type Page } from "@playwright/test";

/**
 * Mushaf line layout — every non-centered `.mushaf-line` must:
 *
 *   (A) Be justified flush to both edges. The rightmost word's right inline-box
 *       must touch `lineRect.right` and the leftmost word's left inline-box must
 *       touch `lineRect.left` (within ~3px for `.mushaf-word`'s 1px padding).
 *       Regression guard for the `flex-grow: 1 + text-align: center` bug.
 *
 *   (B) Contain its painted glyph ink. No glyph may paint pixels outside the
 *       line container's screen rect. QCF fonts use connector glyphs (kashidas,
 *       superscripts) whose advance width is small but whose ink reaches into
 *       the adjacent slot — that's intentional INSIDE the line, but if it
 *       happens at the line edge it would clip or visually break alignment.
 *
 * (B) is measured by rendering each word's text to canvas at its computed
 * font, finding non-background pixels (the ink), and projecting that back
 * onto the line's coordinates. (A) uses `Range.getBoundingClientRect` which
 * measures inline-box bounds, NOT ink — so (A) and (B) catch different bugs.
 */

const TOTAL_PAGES = 604;
const EDGE_TOLERANCE_PX = 3;       // (A) inline-box flush-edge gap
const INK_OVERFLOW_TOLERANCE_PX = 1; // (B) painted-ink overflow past line rect

type LineMetric = {
    idx: number;
    lineW: number;
    wordCount: number;
    firstGlyphRightGap: number;   // (A)
    lastGlyphLeftGap: number;     // (A)
    inkLeftOverflow: number;      // (B) max px of ink past line.left across all words on the line
    inkRightOverflow: number;     // (B) max px of ink past line.right
    isCentered: boolean;
};

async function measureLines(page: Page): Promise<LineMetric[]> {
    await page.waitForFunction(
        () => {
            const lines = document.querySelectorAll(".mushaf-line");
            if (lines.length === 0) return false;
            for (const line of Array.from(lines)) {
                if (line.querySelectorAll(".mushaf-word").length === 0) return false;
            }
            return true;
        },
        { timeout: 20_000 }
    );
    await page.waitForTimeout(100);

    return await page.evaluate(() => {
        function rangeRect(el: Element): DOMRect {
            const r = document.createRange();
            r.selectNodeContents(el);
            return r.getBoundingClientRect();
        }

        // Render the word's text to a canvas at the exact computed font and
        // scan for non-background pixels to find painted ink extents.
        // Returns ink offsets relative to the canvas-text origin, plus the
        // logical advance width that measureText reports for the same text.
        type InkBounds = { advanceW: number; inkL: number; inkR: number } | null;
        const inkCache = new Map<string, InkBounds>();
        function inkBounds(text: string, font: string): InkBounds {
            const key = `${font}|${text}`;
            const cached = inkCache.get(key);
            if (cached !== undefined) return cached;
            // measureText needs a numeric size; parse it from the font shorthand
            const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
            const fontPx = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
            const PADDING = 32; // big enough to capture left side-bearing or kashida overhang
            const c = document.createElement("canvas");
            c.width = Math.ceil(fontPx * 8) + PADDING * 2;
            c.height = Math.ceil(fontPx * 4);
            const ctx = c.getContext("2d");
            if (!ctx) {
                inkCache.set(key, null);
                return null;
            }
            ctx.font = font;
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.fillStyle = "#fff";
            ctx.fillText(text, PADDING, c.height / 2);
            const m = ctx.measureText(text);
            const img = ctx.getImageData(0, 0, c.width, c.height).data;
            let minX = c.width, maxX = -1;
            for (let y = 0; y < c.height; y++) {
                const rowOff = y * c.width * 4;
                for (let x = 0; x < c.width; x++) {
                    if (img[rowOff + x * 4] > 50) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                    }
                }
            }
            const result: InkBounds = maxX >= 0
                ? { advanceW: m.width, inkL: minX - PADDING, inkR: maxX - PADDING }
                : null;
            inkCache.set(key, result);
            return result;
        }

        const lines = document.querySelectorAll<HTMLElement>(".mushaf-line");
        const out: {
            idx: number;
            lineW: number;
            wordCount: number;
            firstGlyphRightGap: number;
            lastGlyphLeftGap: number;
            inkLeftOverflow: number;
            inkRightOverflow: number;
            isCentered: boolean;
        }[] = [];

        lines.forEach((line, idx) => {
            const isCentered = line.classList.contains("mushaf-line-centered");
            const lineRect = line.getBoundingClientRect();
            const words = line.querySelectorAll<HTMLElement>(".mushaf-word");

            let firstGlyphRightGap = 0;
            let lastGlyphLeftGap = 0;
            let inkLeftOverflow = 0;
            let inkRightOverflow = 0;

            if (words.length > 0) {
                const first = words[0];
                const last = words[words.length - 1];
                const fg = rangeRect(first);
                const lg = rangeRect(last);
                firstGlyphRightGap = lineRect.right - fg.right;
                lastGlyphLeftGap = lg.left - lineRect.left;

                // (B) Ink-overflow scan over every word.
                // Word inline-box on screen has `padding: 0 1px`. Canvas
                // ink offsets are LTR-origin. The word's text origin maps to
                // wordRect.left + leftPadding on screen; ink extends from
                // (origin + inkL) to (origin + inkR) horizontally.
                words.forEach((w) => {
                    const text = w.textContent || "";
                    if (!text) return;
                    const cs = getComputedStyle(w);
                    const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                    const ib = inkBounds(text, font);
                    if (!ib) return;
                    const wRect = w.getBoundingClientRect();
                    const padL = parseFloat(cs.paddingLeft) || 0;
                    const originX = wRect.left + padL;
                    const inkLeftScreen = originX + ib.inkL;
                    const inkRightScreen = originX + ib.inkR;
                    const left = lineRect.left - inkLeftScreen;   // > 0 → ink past left edge
                    const right = inkRightScreen - lineRect.right; // > 0 → ink past right edge
                    if (left > inkLeftOverflow) inkLeftOverflow = left;
                    if (right > inkRightOverflow) inkRightOverflow = right;
                });
            }

            out.push({
                idx,
                lineW: Number(lineRect.width.toFixed(2)),
                wordCount: words.length,
                firstGlyphRightGap: Number(firstGlyphRightGap.toFixed(2)),
                lastGlyphLeftGap: Number(lastGlyphLeftGap.toFixed(2)),
                inkLeftOverflow: Number(inkLeftOverflow.toFixed(2)),
                inkRightOverflow: Number(inkRightOverflow.toFixed(2)),
                isCentered,
            });
        });
        return out;
    });
}

test.describe.configure({ mode: "parallel" });

test.describe("Mushaf line boundaries — justified flush + no glyph-ink overflow", () => {
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        test(`p${pageNum}`, async ({ page }) => {
            await page.goto(`/p/${pageNum}`, { waitUntil: "domcontentloaded" });
            const metrics = await measureLines(page);

            expect(metrics.length, "page has mushaf lines").toBeGreaterThan(0);

            const justifyOffenders = metrics.filter(
                (m) =>
                    !m.isCentered &&
                    m.wordCount > 0 &&
                    (m.firstGlyphRightGap > EDGE_TOLERANCE_PX ||
                        m.lastGlyphLeftGap > EDGE_TOLERANCE_PX)
            );
            const inkOffenders = metrics.filter(
                (m) =>
                    m.wordCount > 0 &&
                    (m.inkLeftOverflow > INK_OVERFLOW_TOLERANCE_PX ||
                        m.inkRightOverflow > INK_OVERFLOW_TOLERANCE_PX)
            );

            const errors: string[] = [];
            if (justifyOffenders.length > 0) {
                const detail = justifyOffenders
                    .slice(0, 5)
                    .map(
                        (o) =>
                            `  line ${o.idx}: lineW=${o.lineW}px, firstRightGap=${o.firstGlyphRightGap}px, lastLeftGap=${o.lastGlyphLeftGap}px (words=${o.wordCount})`
                    )
                    .join("\n");
                errors.push(
                    `${justifyOffenders.length}/${metrics.length} lines exceed ${EDGE_TOLERANCE_PX}px edge-gap tolerance\n${detail}`
                );
            }
            if (inkOffenders.length > 0) {
                const detail = inkOffenders
                    .slice(0, 5)
                    .map(
                        (o) =>
                            `  line ${o.idx}: inkLeftOverflow=${o.inkLeftOverflow}px, inkRightOverflow=${o.inkRightOverflow}px`
                    )
                    .join("\n");
                errors.push(
                    `${inkOffenders.length}/${metrics.length} lines have glyph ink overflowing line container > ${INK_OVERFLOW_TOLERANCE_PX}px\n${detail}`
                );
            }

            if (errors.length > 0) {
                throw new Error(`p${pageNum}: ${errors.join("\n")}`);
            }
        });
    }
});
