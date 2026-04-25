#!/usr/bin/env bun
/**
 * Verify the chosen --mushaf-base-size multiplier holds across a range of
 * viewport sizes. The new CSS is already live; this script just opens
 * `bun dev` at multiple viewports and reports per-page max ratio.
 */

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PAGES = [3, 50, 110, 254, 255, 300, 500, 575, 600];
const VIEWPORTS = [
  { w: 390, h: 844 },   // iPhone 14
  { w: 412, h: 915 },   // Pixel 7
  { w: 500, h: 844 },
  { w: 768, h: 1024 },  // iPad
  { w: 1280, h: 800 },  // small laptop
  { w: 1920, h: 1080 }, // desktop
  { w: 500, h: 406 },   // matches devtools panel chrome
];

async function main() {
  const browser = await chromium.launch();
  const results: { vp: string; page: number; max: number; pageW: number; fontPx: number }[] = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    for (const pn of PAGES) {
      try {
        await page.goto(`${BASE_URL}/p/${pn}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForFunction(
          () => {
            const lines = document.querySelectorAll(".mushaf-line");
            if (lines.length === 0) return false;
            for (const line of Array.from(lines)) if (line.querySelectorAll(".mushaf-word").length === 0) return false;
            return true;
          },
          { timeout: 30_000 }
        );
        await page.waitForTimeout(150);
        const { max, pageW, fontPx } = await page.evaluate(() => {
          const ratios: number[] = [];
          document.querySelectorAll<HTMLElement>(".mushaf-line").forEach((l) => {
            if (l.classList.contains("mushaf-line-centered")) return;
            const lr = l.getBoundingClientRect();
            if (lr.width <= 0) return;
            const ws = l.querySelectorAll<HTMLElement>(".mushaf-word");
            if (ws.length === 0) return;
            let s = 0;
            ws.forEach((w) => { s += w.getBoundingClientRect().width; });
            ratios.push(s / lr.width);
          });
          const pg = document.querySelector<HTMLElement>(".mushaf-page");
          return {
            max: Math.max(...ratios, 0),
            pageW: pg?.getBoundingClientRect().width ?? 0,
            fontPx: parseFloat(getComputedStyle(pg!).fontSize),
          };
        });
        results.push({ vp: `${vp.w}×${vp.h}`, page: pn, max, pageW, fontPx });
      } catch (e) {
        console.error(`${vp.w}×${vp.h} p${pn} failed:`, e);
      }
    }
    await ctx.close();
  }
  await browser.close();

  console.log("\nResults:");
  console.log("vp           page   pageW   fontPx   max ratio");
  for (const r of results) {
    const status = r.max > 1.005 ? " ⚠️ OVERFLOW" : "";
    console.log(`${r.vp.padEnd(12)} ${String(r.page).padStart(4)}   ${r.pageW.toFixed(1).padStart(6)}  ${r.fontPx.toFixed(2).padStart(6)}    ${r.max.toFixed(4)}${status}`);
  }
  // Aggregate
  const grouped = new Map<string, number>();
  for (const r of results) {
    const cur = grouped.get(r.vp) ?? 0;
    if (r.max > cur) grouped.set(r.vp, r.max);
  }
  console.log("\nWorst-case max ratio per viewport:");
  for (const [vp, max] of grouped) {
    console.log(`  ${vp}: ${max.toFixed(4)}${max > 1.005 ? " ⚠️" : ""}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
