import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "../src/lib/constants";
import type { MushafCode } from "../src/lib/preferences";

const MUSHAF_CODES: MushafCode[] = ["v1", "v2", "t4", "ut", "i5", "i6", "qh", "tj"];
const CONCURRENCY = 10;

// Error tracker object
const stats = {
  success: 0,
  errors: {
    "404 (Not Found)": 0,
    "500 (Server Error)": 0,
    "Network/Timeout": 0,
    "Other": 0,
  }
};

async function main() {
  const code = (getArg("--code") as MushafCode) || usageAndExit("Missing --code");
  const outDir = path.join(process.cwd(), "public/mushaf-fonts", code);
  await mkdir(outDir, { recursive: true });

  const range = hasFlag("--all") ? { start: 1, end: TOTAL_PAGES } : parsePageRange(getArg("--pages") || "1-1");
  const baseUrl = `https://static.qurancdn.com/fonts/quran/hafs/${code}/woff2`;

  console.log(`🚀 Syncing ${code} fonts [Pages ${range.start}-${range.end}]...`);

  const queue = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  
  // Process in chunks to maintain concurrency
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const chunk = queue.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(page => download(baseUrl, outDir, page)));
    process.stdout.write(`\rProgress: ${stats.success + Object.values(stats.errors).reduce((a, b) => a + b)} / ${queue.length}`);
  }

  printSummary(code);
}

async function download(base: string, out: string, page: number) {
  const url = `${base}/p${page}.woff2`;
  const dest = path.join(out, `p${String(page).padStart(3, "0")}.woff2`);
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10s timeout
    
    if (res.ok) {
      await Bun.write(dest, res);
      stats.success++;
    } else {
      if (res.status === 404) stats.errors["404 (Not Found)"]++;
      else if (res.status >= 500) stats.errors["500 (Server Error)"]++;
      else stats.errors["Other"]++;
    }
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.code === "ECONNRESET") {
      stats.errors["Network/Timeout"]++;
    } else {
      stats.errors["Other"]++;
    }
  }
}

function printSummary(code: string) {
  console.log(`\n\n--- 📊 Download Summary for ${code} ---`);
  console.log(`✅ Successful: ${stats.success}`);
  
  const hasErrors = Object.values(stats.errors).some(v => v > 0);
  if (hasErrors) {
    console.table(stats.errors);
    if (stats.errors["404 (Not Found)"] > 0) {
      console.log(`💡 Tip: 404s for "${code}" suggest this Mushaf variant isn't hosted on this CDN.`);
    }
  } else {
    console.log("⭐ Perfect run! No errors encountered.");
  }
}

// --- Standard Helpers ---
function getArg(name: string) { return process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null; }
function hasFlag(name: string) { return process.argv.includes(name); }
function parsePageRange(input: string) {
  const [s, e] = input.split("-").map(Number);
  return { start: s || 1, end: e || s || 1 };
}
function usageAndExit(msg: string): never {
  console.error(`❌ ${msg}\nUsage: bun script.ts --code v1 --all`);
  process.exit(1);
}

main();
