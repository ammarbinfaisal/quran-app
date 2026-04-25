#!/usr/bin/env bun
/**
 * Measure the binding sumW/lineW ratio across all 604 v2 pages at the
 * tightest test viewport, using the live CSS (no overrides). Reports the
 * page that pushes the binding constraint and the divisor that guarantees
 * every line fits with a configurable safety margin.
 *
 * Usage: bun run scripts/measure-binding-ratio.ts [start-end]
 */

import { chromium, type Page } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOTAL_PAGES = 604;
const WORKERS = Number(process.env.WORKERS || 4);
// Use the smallest realistic test viewport — sub-pixel rounding is worst here.
const VIEWPORT = { width: 390, height: 844 };

type PageResult = { page: number; maxRatio: number; lineCount: number; bindingLineIdx: number };

async function measurePage(p: Page, pageNum: number): Promise<PageResult | null> {
  await p.goto(`${BASE_URL}/p/${pageNum}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await p.waitForFunction(
    () => {
      const lines = document.querySelectorAll(".mushaf-line");
      if (lines.length === 0) return false;
      for (const l of Array.from(lines)) if (l.querySelectorAll(".mushaf-word").length === 0) return false;
      return true;
    },
    { timeout: 30_000 }
  );
  await p.waitForTimeout(150);

  return await p.evaluate(() => {
    let maxRatio = 0;
    let bindingLineIdx = -1;
    let lineCount = 0;
    document.querySelectorAll<HTMLElement>(".mushaf-line").forEach((l, i) => {
      if (l.classList.contains("mushaf-line-centered")) return;
      const lr = l.getBoundingClientRect();
      if (lr.width <= 0) return;
      const ws = l.querySelectorAll<HTMLElement>(".mushaf-word");
      if (ws.length === 0) return;
      let s = 0;
      ws.forEach((w) => { s += w.getBoundingClientRect().width; });
      const r = s / lr.width;
      lineCount++;
      if (r > maxRatio) { maxRatio = r; bindingLineIdx = i; }
    });
    return { page: 0, maxRatio, lineCount, bindingLineIdx };
  }).then((r) => ({ ...r, page: pageNum }));
}

async function worker(pages: number[], workerId: number): Promise<PageResult[]> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const p = await ctx.newPage();
  const results: PageResult[] = [];
  for (const pageNum of pages) {
    try {
      const r = await measurePage(p, pageNum);
      if (r) results.push(r);
      if (results.length % 50 === 0) console.log(`  worker ${workerId}: ${results.length}/${pages.length}`);
    } catch (e) {
      console.error(`  worker ${workerId}: page ${pageNum} failed: ${e}`);
    }
  }
  await browser.close();
  return results;
}

async function main() {
  const arg = process.argv[2];
  let pages: number[];
  if (arg && /^\d+-\d+$/.test(arg)) {
    const [a, b] = arg.split("-").map(Number);
    pages = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else {
    pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  }
  const buckets: number[][] = Array.from({ length: WORKERS }, () => []);
  pages.forEach((p, i) => buckets[i % WORKERS].push(p));

  console.log(`Measuring ${pages.length} pages at ${VIEWPORT.width}×${VIEWPORT.height} (live CSS)…`);
  const t0 = Date.now();
  const all = (await Promise.all(buckets.map((b, i) => worker(b, i)))).flat();
  all.sort((a, b) => b.maxRatio - a.maxRatio);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  const valid = all.filter((r) => r.lineCount > 0);
  console.log(`\nTop 10 binding pages (max sumW/lineW under live CSS):`);
  valid.slice(0, 10).forEach((r) => console.log(`  p${r.page}: max=${r.maxRatio.toFixed(4)} (line ${r.bindingLineIdx})`));

  const globalMax = valid[0].maxRatio;
  // Current divisor — read from script env or default
  const currentDivisor = Number(process.env.CURRENT_DIVISOR || 16.24);
  // The current divisor produced ratio = globalMax. To make ratio = 1.0 exactly
  // (no overflow), divisor must scale by globalMax: newDivisor = currentDivisor * globalMax.
  // Add a 0.5% safety margin for sub-pixel rounding across browsers/viewports.
  const tightDivisor = currentDivisor * globalMax;
  const safeDivisor = tightDivisor * 1.005;

  console.log(`\nGlobal max ratio under current divisor (${currentDivisor}): ${globalMax.toFixed(4)} on p${valid[0].page}`);
  console.log(`Tight divisor (ratio = 1.0 exactly):    ${tightDivisor.toFixed(4)}`);
  console.log(`Safe divisor (+0.5% safety margin):     ${safeDivisor.toFixed(4)}`);
  console.log(`\n→ Replace 16.24 with ${safeDivisor.toFixed(4)} in globals.css.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
