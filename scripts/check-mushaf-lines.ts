#!/usr/bin/env bun
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const TOTAL = 604;
const SAMPLE = Number.parseInt(process.env.SAMPLE || "100", 10);
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY || "4", 10);

// Tolerance: QCF words use 1px padding on each side, plus glyph side-bearing.
// Any gap larger than this at line edges is considered a failure.
const EDGE_TOLERANCE = 3;

type LineMetric = {
  idx: number;
  lineW: number;
  wordCount: number;
  wordTotal: number;
  freeSpace: number;
  firstGlyphRightGap: number; // RTL: gap between line's right edge and first word's glyph right edge
  lastGlyphLeftGap: number; // RTL: gap between line's left edge and last word's glyph left edge
  isCentered: boolean;
};

type PageResult = {
  page: number;
  containerW: number;
  lineCount: number;
  lines: LineMetric[];
  failures: LineMetric[];
};

async function measurePage(page: Page, pageNum: number): Promise<PageResult> {
  await page.goto(`${BASE}/p/${pageNum}`, { waitUntil: "domcontentloaded" });

  // Wait until fonts are ready AND all mushaf-line elements have rendered real words
  // (not the skeleton placeholder which has no .mushaf-word children).
  await page.waitForFunction(
    () => {
      const lines = document.querySelectorAll(".mushaf-line");
      if (lines.length === 0) return false;
      // Every line must have at least one .mushaf-word child (skeleton has none).
      for (const line of Array.from(lines)) {
        if (line.querySelectorAll(".mushaf-word").length === 0) return false;
      }
      return (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
        ? true
        : true;
    },
    { timeout: 15000 }
  );
  // Small settle for layout after font swap
  await page.waitForTimeout(120);

  return await page.evaluate((pageNum) => {
    function measureGlyph(el: Element): DOMRect {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    }
    const lines = document.querySelectorAll<HTMLElement>(".mushaf-line");
    const container = lines[0]?.parentElement;
    const cRect = container?.getBoundingClientRect();
    const containerW = cRect?.width ?? 0;
    const out: LineMetric[] = [];
    lines.forEach((line, idx) => {
      const isCentered = line.classList.contains("mushaf-line-centered");
      const lineRect = line.getBoundingClientRect();
      const words = line.querySelectorAll<HTMLElement>(".mushaf-word");
      let wordTotal = 0;
      words.forEach((w) => {
        wordTotal += w.getBoundingClientRect().width;
      });
      const first = words[0];
      const last = words[words.length - 1];
      let firstGlyphRightGap = 0;
      let lastGlyphLeftGap = 0;
      if (first && last) {
        const fg = measureGlyph(first);
        const lg = measureGlyph(last);
        firstGlyphRightGap = lineRect.right - fg.right; // RTL: first word is rightmost
        lastGlyphLeftGap = lg.left - lineRect.left; // RTL: last word is leftmost
      }
      out.push({
        idx,
        lineW: Number(lineRect.width.toFixed(2)),
        wordCount: words.length,
        wordTotal: Number(wordTotal.toFixed(2)),
        freeSpace: Number((lineRect.width - wordTotal).toFixed(2)),
        firstGlyphRightGap: Number(firstGlyphRightGap.toFixed(2)),
        lastGlyphLeftGap: Number(lastGlyphLeftGap.toFixed(2)),
        isCentered,
      });
    });
    return {
      page: pageNum,
      containerW: Number(containerW.toFixed(2)),
      lineCount: lines.length,
      lines: out,
      failures: [] as LineMetric[],
    };
  }, pageNum);
}

function classifyFailures(result: PageResult): LineMetric[] {
  return result.lines.filter((l) => {
    if (l.isCentered) return false;
    // Flag a line if first word's glyph doesn't reach the right edge
    // or last word's glyph doesn't reach the left edge (within tolerance).
    return (
      l.firstGlyphRightGap > EDGE_TOLERANCE ||
      l.lastGlyphLeftGap > EDGE_TOLERANCE
    );
  });
}

async function runWorker(pages: number[], worker: number): Promise<PageResult[]> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await ctx.newPage();
  const results: PageResult[] = [];
  for (const p of pages) {
    try {
      const r = await measurePage(page, p);
      r.failures = classifyFailures(r);
      results.push(r);
      if (r.failures.length > 0) {
        console.log(
          `[w${worker}] p${p}: ${r.lineCount} lines, ${r.failures.length} FAIL (edge gap > ${EDGE_TOLERANCE}px)`
        );
      } else {
        console.log(`[w${worker}] p${p}: ${r.lineCount} lines OK`);
      }
    } catch (e) {
      console.log(`[w${worker}] p${p}: ERROR ${(e as Error).message}`);
    }
  }
  await browser.close();
  return results;
}

function sample(n: number, max: number): number[] {
  if (n >= max) return Array.from({ length: max }, (_, i) => i + 1);
  const set = new Set<number>();
  while (set.size < n) set.add(1 + Math.floor(Math.random() * max));
  return [...set].sort((a, b) => a - b);
}

async function main() {
  const pages = sample(SAMPLE, TOTAL);
  console.log(`Sampling ${pages.length} pages with ${CONCURRENCY} workers: ${pages.slice(0, 10).join(",")}${pages.length > 10 ? ",..." : ""}`);

  // Shard pages across workers
  const shards: number[][] = Array.from({ length: CONCURRENCY }, () => []);
  pages.forEach((p, i) => shards[i % CONCURRENCY].push(p));

  const t0 = Date.now();
  const all = (await Promise.all(shards.map((s, i) => runWorker(s, i)))).flat();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  // Aggregate
  let totalLines = 0;
  let totalFailures = 0;
  const failingPages: { page: number; count: number; examples: LineMetric[] }[] = [];
  for (const r of all) {
    totalLines += r.lineCount;
    totalFailures += r.failures.length;
    if (r.failures.length > 0) {
      failingPages.push({ page: r.page, count: r.failures.length, examples: r.failures.slice(0, 3) });
    }
  }

  console.log(`\n=== SUMMARY (${dt}s) ===`);
  console.log(`Pages checked: ${all.length}`);
  console.log(`Total lines: ${totalLines}`);
  console.log(`Failing lines: ${totalFailures} (${((totalFailures / totalLines) * 100).toFixed(2)}%)`);
  console.log(`Pages with >=1 failure: ${failingPages.length}`);

  if (failingPages.length > 0) {
    console.log(`\nTop failing pages (first 15):`);
    failingPages
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .forEach((f) => {
        console.log(`  p${f.page}: ${f.count} bad lines`);
        f.examples.forEach((ex) =>
          console.log(
            `    line ${ex.idx}: free=${ex.freeSpace}px, firstRightGap=${ex.firstGlyphRightGap}px, lastLeftGap=${ex.lastGlyphLeftGap}px`
          )
        );
      });
  }

  // Stats on edge gaps (distribution)
  const allLines = all.flatMap((r) => r.lines.filter((l) => !l.isCentered));
  const firstGaps = allLines.map((l) => l.firstGlyphRightGap).sort((a, b) => a - b);
  const lastGaps = allLines.map((l) => l.lastGlyphLeftGap).sort((a, b) => a - b);
  const pct = (arr: number[], p: number) => arr[Math.floor(arr.length * p)];
  console.log(`\nEdge-gap distribution (non-centered lines, n=${allLines.length}):`);
  console.log(
    `  firstGlyphRightGap: p50=${pct(firstGaps, 0.5)?.toFixed(2)}, p95=${pct(firstGaps, 0.95)?.toFixed(2)}, p99=${pct(firstGaps, 0.99)?.toFixed(2)}, max=${firstGaps[firstGaps.length - 1]?.toFixed(2)}`
  );
  console.log(
    `  lastGlyphLeftGap:  p50=${pct(lastGaps, 0.5)?.toFixed(2)}, p95=${pct(lastGaps, 0.95)?.toFixed(2)}, p99=${pct(lastGaps, 0.99)?.toFixed(2)}, max=${lastGaps[lastGaps.length - 1]?.toFixed(2)}`
  );

  process.exit(totalFailures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
