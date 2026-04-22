import { test, expect, type Page } from "@playwright/test";

// Every non-centered `.mushaf-line` must be justified such that the first
// word's glyph sits flush with the line's right edge (RTL: rightmost word)
// and the last word's glyph sits flush with the line's left edge. Regression
// guard for the `flex-grow: 1 + text-align: center` bug on QCF words.

const TOTAL_PAGES = 604;
// `.mushaf-word` has `padding: 0 1px` plus tiny font side-bearing; 3px is a
// comfortable ceiling that still catches the centered-in-inflated-slot bug
// (which produced ~5-20px gaps depending on word-width distribution).
const EDGE_TOLERANCE_PX = 3;

type LineMetric = {
    idx: number;
    lineW: number;
    wordCount: number;
    firstGlyphRightGap: number;
    lastGlyphLeftGap: number;
    isCentered: boolean;
};

async function measureLines(page: Page): Promise<LineMetric[]> {
    // Skeleton lines have no `.mushaf-word` children — wait until every line
    // has been populated with real words (i.e. font+data have resolved).
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
    // Small settle for layout after font swap
    await page.waitForTimeout(100);

    return await page.evaluate(() => {
        function measureGlyph(el: Element): DOMRect {
            const r = document.createRange();
            r.selectNodeContents(el);
            return r.getBoundingClientRect();
        }
        const lines = document.querySelectorAll<HTMLElement>(".mushaf-line");
        const out: {
            idx: number;
            lineW: number;
            wordCount: number;
            firstGlyphRightGap: number;
            lastGlyphLeftGap: number;
            isCentered: boolean;
        }[] = [];
        lines.forEach((line, idx) => {
            const isCentered = line.classList.contains("mushaf-line-centered");
            const lineRect = line.getBoundingClientRect();
            const words = line.querySelectorAll<HTMLElement>(".mushaf-word");
            let firstGlyphRightGap = 0;
            let lastGlyphLeftGap = 0;
            if (words.length > 0) {
                const first = words[0];
                const last = words[words.length - 1];
                const fg = measureGlyph(first);
                const lg = measureGlyph(last);
                // RTL: first word = rightmost visually; last word = leftmost.
                firstGlyphRightGap = lineRect.right - fg.right;
                lastGlyphLeftGap = lg.left - lineRect.left;
            }
            out.push({
                idx,
                lineW: Number(lineRect.width.toFixed(2)),
                wordCount: words.length,
                firstGlyphRightGap: Number(firstGlyphRightGap.toFixed(2)),
                lastGlyphLeftGap: Number(lastGlyphLeftGap.toFixed(2)),
                isCentered,
            });
        });
        return out;
    });
}

test.describe.configure({ mode: "parallel" });

test.describe("Mushaf line boundaries — every line justified flush to both edges", () => {
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        test(`p${pageNum}`, async ({ page }) => {
            await page.goto(`/p/${pageNum}`, { waitUntil: "domcontentloaded" });
            const metrics = await measureLines(page);

            expect(metrics.length, "page has mushaf lines").toBeGreaterThan(0);

            const offenders = metrics.filter(
                (m) =>
                    !m.isCentered &&
                    m.wordCount > 0 &&
                    (m.firstGlyphRightGap > EDGE_TOLERANCE_PX ||
                        m.lastGlyphLeftGap > EDGE_TOLERANCE_PX)
            );

            if (offenders.length > 0) {
                const detail = offenders
                    .slice(0, 5)
                    .map(
                        (o) =>
                            `  line ${o.idx}: lineW=${o.lineW}px, firstRightGap=${o.firstGlyphRightGap}px, lastLeftGap=${o.lastGlyphLeftGap}px (words=${o.wordCount})`
                    )
                    .join("\n");
                throw new Error(
                    `p${pageNum}: ${offenders.length}/${metrics.length} lines exceed ${EDGE_TOLERANCE_PX}px edge-gap tolerance\n${detail}`
                );
            }
        });
    }
});
