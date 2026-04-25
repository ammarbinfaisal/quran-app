#!/usr/bin/env bun
/**
 * Check whether the QCF v2 font's natural-line-to-font-size ratio is
 * scale-invariant. Forces font-size to a fixed pixel value across viewports
 * and reports the ratio (sum-of-word-widths) / font-size.
 */

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PAGE_NUM = 254; // binding page
const FONT_SIZES = [16, 20, 24, 28, 32, 40];
const VIEWPORT = { width: 1280, height: 1024 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  const out: { fontPx: number; sumWMax: number; sumWMin: number; lineCount: number; ratio: number }[] = [];
  for (const fontPx of FONT_SIZES) {
    await page.goto(`${BASE_URL}/p/${PAGE_NUM}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.addStyleTag({
      content: `.mushaf-page { font-size: ${fontPx}px !important; --mushaf-base-size: ${fontPx}px !important; } .mushaf-line { display: block !important; text-align: center !important; direction: rtl !important; width: 100% !important; } .mushaf-word { display: inline-block !important; padding: 0 !important; }`,
    });
    await page.waitForFunction(
      () => {
        const lines = document.querySelectorAll(".mushaf-line");
        if (lines.length === 0) return false;
        for (const l of Array.from(lines)) if (l.querySelectorAll(".mushaf-word").length === 0) return false;
        return true;
      },
      { timeout: 30_000 }
    );
    await page.waitForTimeout(200);
    const widths = await page.evaluate(() => {
      const out: number[] = [];
      document.querySelectorAll<HTMLElement>(".mushaf-line").forEach((l) => {
        if (l.classList.contains("mushaf-line-centered")) return;
        const ws = l.querySelectorAll<HTMLElement>(".mushaf-word");
        if (ws.length === 0) return;
        let s = 0;
        ws.forEach((w) => { s += w.getBoundingClientRect().width; });
        out.push(s);
      });
      return out;
    });
    const max = Math.max(...widths);
    const min = Math.min(...widths);
    out.push({ fontPx, sumWMax: max, sumWMin: min, lineCount: widths.length, ratio: max / fontPx });
  }

  console.log(`Page ${PAGE_NUM}, viewport ${VIEWPORT.width}×${VIEWPORT.height}:`);
  console.log("font-px   sumW-max   sumW-min   ratio (sumW-max / font)");
  for (const r of out) {
    console.log(`  ${String(r.fontPx).padStart(3)}px    ${r.sumWMax.toFixed(1).padStart(7)}    ${r.sumWMin.toFixed(1).padStart(7)}    ${r.ratio.toFixed(3)}`);
  }
  console.log("\nIf the font is scale-invariant, all ratios should be ≈ equal.");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
