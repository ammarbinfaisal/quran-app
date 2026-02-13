import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function buildHarness(outFile: string) {
  const entry = path.join(process.cwd(), "tests", "perf", "harness", "mushaf-harness.tsx");
  await execFileAsync("bun", [
    "build",
    "--target=browser",
    "--format=iife",
    "--outfile",
    outFile,
    entry,
  ]);
}

test("fast scroll: trace + CLS evidence (portless)", async ({ page }) => {
  const evidenceDir = path.join(process.cwd(), "ss_evidence");
  await fs.mkdir(evidenceDir, { recursive: true });

  const startedAt = new Date().toISOString().replaceAll(":", "-");
  const harnessPath = path.join(evidenceDir, `mushaf-harness-${startedAt}.js`);
  await buildHarness(harnessPath);

  const tracePath = path.join(evidenceDir, `mushaf-scroll-trace-${startedAt}.zip`);
  const startShot = path.join(evidenceDir, `mushaf-scroll-start-${startedAt}.png`);
  const endShot = path.join(evidenceDir, `mushaf-scroll-end-${startedAt}.png`);
  const summaryPath = path.join(evidenceDir, `mushaf-scroll-summary-${startedAt}.json`);

  await page.addInitScript(() => {
    type MushafWindow = Window & { __mushaf_cls?: number };
    const w = window as MushafWindow;
    w.__mushaf_cls = 0;
    try {
      const po = new PerformanceObserver((list) => {
        type LayoutShiftEntry = PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
        };
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          if (entry.hadRecentInput) continue;
          w.__mushaf_cls = (w.__mushaf_cls ?? 0) + (entry.value ?? 0);
        }
      });
      po.observe({ type: "layout-shift", buffered: true } as unknown as PerformanceObserverInit);
    } catch {
      // ignore
    }
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; }
      #root { height: 100%; }
      .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
      .scrollbar-none::-webkit-scrollbar { display: none; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="/assets/harness.js"></script>
  </body>
</html>`;

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    // Main document
    if (url.host === "mushaf.test" && url.pathname === "/") {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
      return;
    }

    // Harness bundle
    if (url.host === "mushaf.test" && url.pathname === "/assets/harness.js") {
      const body = await fs.readFile(harnessPath);
      await route.fulfill({ status: 200, contentType: "text/javascript", body });
      return;
    }

    // Serve mushaf-data / mushaf-fonts out of ./public
    if (url.host === "mushaf.test" && (url.pathname.startsWith("/mushaf-data/") || url.pathname.startsWith("/mushaf-fonts/"))) {
      const localPath = path.join(process.cwd(), "public", url.pathname);
      try {
        const body = await fs.readFile(localPath);
        const contentType = url.pathname.endsWith(".json")
          ? "application/json"
          : url.pathname.endsWith(".pb")
            ? "application/octet-stream"
            : url.pathname.endsWith(".woff2")
              ? "font/woff2"
              : "application/octet-stream";
        await route.fulfill({ status: 200, contentType, body });
      } catch {
        await route.fulfill({ status: 404, body: "not found" });
      }
      return;
    }

    await route.fulfill({ status: 404, body: "not found" });
  });

  await page.goto("http://mushaf.test/", { waitUntil: "domcontentloaded" });

  const scroller = page.getByTestId("mushaf-scroll");
  await expect(scroller).toBeVisible({ timeout: 30_000 });

  const context = page.context();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });

  await page.screenshot({ path: startShot });

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="mushaf-scroll"]') as HTMLElement | null;
    if (!el) throw new Error("missing scroller");
    const max = el.scrollHeight - el.clientHeight;
    const steps = 30;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      el.scrollTop = Math.floor(max * t);
    }
  });

  // Let RAF windowing/prefetch settle.
  await page.waitForTimeout(600);
  await page.screenshot({ path: endShot });

  const cls = await page.evaluate(() => {
    type MushafWindow = Window & { __mushaf_cls?: number };
    return (window as MushafWindow).__mushaf_cls ?? null;
  });

  await context.tracing.stop({ path: tracePath });

  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        url: "http://mushaf.test/",
        cls,
        at: startedAt,
      },
      null,
      2
    ),
    "utf8"
  );
});

