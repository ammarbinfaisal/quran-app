import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const USER_AGENT = "quran.tarteel.tv (scraper)";

// Total ayahs per surah (standard Madani count)
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const TAFSIR_SOURCES = [
  { id: "ibn-katheer", label: "Tafsir Ibn Kathir", full: true },
  { id: "tabari", label: "Tafsir al-Tabari", full: true },
  { id: "qurtubi", label: "Tafsir al-Qurtubi", full: true },
  { id: "baghawi", label: "Tafsir al-Baghawi", full: true },
  { id: "ibn-uthaymeen", label: "Tafsir Ibn Uthaymeen", full: false },
  { id: "ibn-alqayyim", label: "Tafsir Ibn al-Qayyim", full: false },
  { id: "iraab-graphs", label: "I'raab Graphs", full: true },
] as const;

const DELAY_MIN = parseInt(process.env.SCRAPE_DELAY_MIN ?? "4000", 10);
const DELAY_MAX = parseInt(process.env.SCRAPE_DELAY_MAX ?? "8000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
}

// Parse CLI args
const args = process.argv.slice(2);
const sourceFilter = args.find((a) => a.startsWith("--source="))?.split("=")[1];
const surahStart = parseInt(
  args.find((a) => a.startsWith("--surah="))?.split("=")[1] ?? "1",
  10,
);

async function fetchTafsir(
  sourceId: string,
  surah: number,
  ayah: number,
): Promise<{ data: string | null; ayahs_start?: number; count?: number }> {
  const url = `https://tafsir.app/get.php?src=${sourceId}&s=${surah}&a=${ayah}&ver=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `https://tafsir.app/${sourceId}/${surah}/${ayah}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function getOutputPath(sourceId: string, surah: number): string {
  if (sourceId === "iraab-graphs") {
    return path.join(process.cwd(), "public/data/iraab", `${surah}.json`);
  }
  return path.join(process.cwd(), "public/data/tafsir", sourceId, `${surah}.json`);
}

function loadExisting(filePath: string): Record<string, unknown> {
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }
  return {};
}

function saveJson(filePath: string, data: Record<string, unknown>) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function scrapeSource(sourceId: string) {
  const isIraab = sourceId === "iraab-graphs";
  console.log(`\n=== Scraping ${sourceId} ===`);

  for (let s = surahStart; s <= 114; s++) {
    const ayahCount = SURAH_AYAH_COUNTS[s - 1];
    const outPath = getOutputPath(sourceId, s);
    const existing = loadExisting(outPath) as Record<string, any>;
    let modified = false;

    // Track which ayahs are covered by groups (from previously scraped data)
    const coveredByGroup = new Set<number>();
    for (const [key, val] of Object.entries(existing)) {
      if (val && typeof val === "object" && "ayahsStart" in val && "count" in val) {
        const start = val.ayahsStart as number;
        const count = val.count as number;
        for (let i = start + 1; i < start + count; i++) {
          coveredByGroup.add(i);
        }
      }
    }

    for (let a = 1; a <= ayahCount; a++) {
      const key = String(a);

      // Skip if already scraped
      if (key in existing) continue;
      // Skip if covered by a group from an earlier entry
      if (coveredByGroup.has(a)) {
        existing[key] = null;
        modified = true;
        continue;
      }

      try {
        const response = await fetchTafsir(sourceId, s, a);
        const data = response.data;

        if (isIraab) {
          existing[key] = data || null;
        } else if (!data) {
          existing[key] = null;
        } else if (response.ayahs_start != null && response.count != null) {
          // Grouped entry — store at the ayahs_start key
          existing[String(response.ayahs_start)] = {
            text: data,
            ayahsStart: response.ayahs_start,
            count: response.count,
          };
          // Mark subsequent ayaat as covered
          if (response.ayahs_start === a && response.count > 1) {
            for (let i = a + 1; i < a + response.count; i++) {
              if (i <= ayahCount) {
                existing[String(i)] = null;
                coveredByGroup.add(i);
              }
            }
          }
        } else {
          existing[key] = { text: data };
        }

        modified = true;
        console.log(`  ${sourceId} ${s}:${a} ✓`);
      } catch (err) {
        console.error(
          `  ${sourceId} ${s}:${a} ✗ ${err instanceof Error ? err.message : err}`,
        );
        // Don't save null on error — leave it un-scraped for retry
      }

      // Save after each ayah
      if (modified) {
        saveJson(outPath, existing);
        modified = false;
      }

      await sleep(randomDelay());
    }

    if (modified) saveJson(outPath, existing);
    console.log(`  Surah ${s} complete (${ayahCount} ayaat)`);
  }
}

async function main() {
  const sources = sourceFilter
    ? TAFSIR_SOURCES.filter((s) => s.id === sourceFilter)
    : [...TAFSIR_SOURCES];

  if (sources.length === 0) {
    console.error(`Unknown source: ${sourceFilter}`);
    console.error(`Available: ${TAFSIR_SOURCES.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  for (const source of sources) {
    await scrapeSource(source.id);
  }

  console.log("\nDone!");
}

main().catch(console.error);
