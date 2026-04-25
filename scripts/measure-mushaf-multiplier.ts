#!/usr/bin/env bun
/**
 * Measure the natural-line-width to container-width ratio for every v2 page,
 * with the inline-block layout active (no flex). Reports the constant we need
 * to multiply --mushaf-base-size by so that the longest natural line on every
 * page exactly fills the line container.
 *
 * Run while `bun dev` is up:
 *   bun run scripts/measure-mushaf-multiplier.ts
 */

import { chromium, type Page } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOTAL_PAGES = 604;
const WORKERS = Number(process.env.WORKERS || 4);

const OVERRIDE_CSS = `
  .mushaf-line { display: block !important; text-align: center !important; direction: rtl !important; width: 100% !important; line-height: 1 !important; }
  .mushaf-line-centered { text-align: center !important; }
  .mushaf-word { display: inline-block !important; padding: 0 !important; flex-shrink: 0 !important; }
  .mushaf-verse-group { display: inline !important; }
`;

type PageResult = { page: number; n: number; avg: number; min: number; max: number };

async function measurePage(page: Page, pageNum: number): Promise<PageResult | null> {
  await page.goto(`${BASE_URL}/p/${pageNum}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.addStyleTag({ content: OVERRIDE_CSS });
  // Wait for fonts and words
  await page.waitForFunction(
    () => {
      const lines = document.querySelectorAll(".mushaf-line");
      if (lines.length === 0) return false;
      for (const line of Array.from(lines)) {
        if (line.querySelectorAll(".mushaf-word").length === 0) return false;
      }
      return true;
    },
    { timeout: 30_000 }
  );
  await page.waitForTimeout(150);

  const ratios = await page.evaluate(() => {
    const out: number[] = [];
    document.querySelectorAll<HTMLElement>(".mushaf-line").forEach((l) => {
      if (l.classList.contains("mushaf-line-centered")) return;
      const lr = l.getBoundingClientRect();
      if (lr.width <= 0) return;
      const ws = l.querySelectorAll<HTMLElement>(".mushaf-word");
      if (ws.length === 0) return;
      let sum = 0;
      ws.forEach((w) => { sum += w.getBoundingClientRect().width; });
      out.push(sum / lr.width);
    });
    return out;
  });

  if (ratios.length === 0) return { page: pageNum, n: 0, avg: 0, min: 0, max: 0 };
  return {
    page: pageNum,
    n: ratios.length,
    avg: ratios.reduce((s, r) => s + r, 0) / ratios.length,
    min: Math.min(...ratios),
    max: Math.max(...ratios),
  };
}

async function worker(pages: number[], workerId: number): Promise<PageResult[]> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 500, height: 844 } });
  const page = await ctx.newPage();
  const results: PageResult[] = [];
  for (const pageNum of pages) {
    try {
      const r = await measurePage(page, pageNum);
      if (r) results.push(r);
      if (results.length % 25 === 0) {
        console.log(`  worker ${workerId}: ${results.length}/${pages.length} done`);
      }
    } catch (e) {
      console.error(`  worker ${workerId}: page ${pageNum} failed: ${e}`);
    }
  }
  await browser.close();
  return results;
}

async function main() {
  // Optional range: bun run … 540-604
  const arg = process.argv[2];
  let pages: number[];
  if (arg && /^\d+-\d+$/.test(arg)) {
    const [a, b] = arg.split("-").map(Number);
    pages = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else {
    pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  }
  // Distribute round-robin
  const buckets: number[][] = Array.from({ length: WORKERS }, () => []);
  pages.forEach((p, i) => buckets[i % WORKERS].push(p));

  console.log(`Measuring ${TOTAL_PAGES} pages across ${WORKERS} workers…`);
  const t0 = Date.now();
  const allResults = (await Promise.all(buckets.map((b, i) => worker(b, i)))).flat();
  allResults.sort((a, b) => a.page - b.page);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${allResults.length} pages.`);

  // Per-page max ratio is the binding constraint. We want the SMALLEST multiplier
  // that still keeps every page's max ≤ 1.0.
  const valid = allResults.filter((r) => r.n > 0);
  if (valid.length === 0) { console.error("no data"); process.exit(1); }

  // Aggregate: page with the LARGEST max ratio sets the upper bound for the
  // multiplier (multiplier = 1 / page.max for that page).
  const maxByPage = valid.map((r) => ({ page: r.page, max: r.max }));
  maxByPage.sort((a, b) => b.max - a.max);
  console.log("\nTop 10 pages by max ratio (binding constraint):");
  maxByPage.slice(0, 10).forEach((p) => console.log(`  p${p.page}: max=${p.max.toFixed(4)} → multiplier ≤ ${(1 / p.max).toFixed(4)}`));

  console.log("\nBottom 10 pages by max ratio (most slack):");
  maxByPage.slice(-10).forEach((p) => console.log(`  p${p.page}: max=${p.max.toFixed(4)} → multiplier ≤ ${(1 / p.max).toFixed(4)}`));

  const globalMax = maxByPage[0].max;
  const idealMultiplier = 1 / globalMax;
  // Average page max gives the multiplier that fills "typical" pages; but lines on the binding page would overflow.
  const avgMax = valid.reduce((s, r) => s + r.max, 0) / valid.length;
  const minMax = maxByPage[maxByPage.length - 1].max;

  console.log(`\nGlobal max ratio across all pages: ${globalMax.toFixed(4)} (page ${maxByPage[0].page})`);
  console.log(`Average per-page max ratio:        ${avgMax.toFixed(4)}`);
  console.log(`Min    per-page max ratio:         ${minMax.toFixed(4)}`);
  console.log(`\n→ Tightest safe multiplier: ${idealMultiplier.toFixed(4)}`);
  console.log(`  (font-size = var(--mushaf-base-size) × ${idealMultiplier.toFixed(4)} fills the longest line on every page)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
