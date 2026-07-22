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
  { id: "adwaa-albayan", label: "Adwaa al-Bayan", full: false },
  { id: "iraab-graphs", label: "I'raab Graphs", full: true },
] as const;

const IRAAB_SOURCE_ID = "iraab-graphs";
const IRAAB_DIR = path.join(process.cwd(), "public/data/iraab");
const IRAAB_VERSES_DIR = path.join(IRAAB_DIR, "verses");
const IRAAB_AVAILABILITY_PATH = path.join(IRAAB_DIR, "availability.json");

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

// --- I3raab split store helpers -------------------------------------------

type IraabAvailability = Record<string, string>;

function loadIraabAvailability(): IraabAvailability {
  if (!existsSync(IRAAB_AVAILABILITY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(IRAAB_AVAILABILITY_PATH, "utf-8")) as IraabAvailability;
  } catch {
    return {};
  }
}

function saveIraabAvailability(data: IraabAvailability): void {
  if (!existsSync(IRAAB_DIR)) mkdirSync(IRAAB_DIR, { recursive: true });
  writeFileSync(IRAAB_AVAILABILITY_PATH, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Sets the availability bit for one ayah. Bit semantics: "1" available,
 * "0" fetched known unavailable, "?" unknown. Positions beyond the bitmap
 * length are implicitly unknown. The bitmap is grown as needed; gaps
 * introduced before the target ayah (previously unknown) are filled with
 * "?" so they remain retryable rather than being recorded as unavailable.
 */
function setIraabAvailabilityBit(
  availability: IraabAvailability,
  surah: number,
  ayah: number,
  available: boolean,
): void {
  const key = String(surah);
  let bitmap = availability[key] ?? "";

  // Grow the bitmap up to and including this ayah, filling any previously
  // unknown gap (beyond the old length) with "?" so those ayahs stay retryable.
  while (bitmap.length < ayah) bitmap += "?";
  bitmap =
    bitmap.substring(0, ayah - 1) +
    (available ? "1" : "0") +
    bitmap.substring(ayah);
  availability[key] = bitmap;
}

function iraabVersePath(surah: number, ayah: number): string {
  return path.join(IRAAB_VERSES_DIR, String(surah), `${ayah}.json`);
}

function writeIraabVerse(surah: number, ayah: number, svg: string): void {
  const filePath = iraabVersePath(surah, ayah);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify({ svg }));
}

async function scrapeSource(sourceId: string) {
  const isIraab = sourceId === IRAAB_SOURCE_ID;
  console.log(`\n=== Scraping ${sourceId} ===`);

  let iraabAvailability: IraabAvailability | null = null;
  if (isIraab) {
    iraabAvailability = loadIraabAvailability();
  }

  for (let s = surahStart; s <= 114; s++) {
    const ayahCount = SURAH_AYAH_COUNTS[s - 1];

    // Non-iraab path keeps the original per-surah JSON output shape.
    let outPath: string | null = null;
    type TafsirStored =
      | { text: string; ayahsStart?: number; count?: number }
      | null;
    let existing: Record<string, TafsirStored> = {};
    if (!isIraab) {
      outPath = getOutputPath(sourceId, s);
      existing = loadExisting(outPath) as Record<string, TafsirStored>;
    }
    let modified = false;

    // Track which ayahs are covered by groups (from previously scraped data)
    const coveredByGroup = new Set<number>();
    for (const [, val] of Object.entries(existing)) {
      if (val && typeof val === "object" && val.ayahsStart != null && val.count != null) {
        const start = val.ayahsStart;
        const count = val.count;
        for (let i = start + 1; i < start + count; i++) {
          coveredByGroup.add(i);
        }
      }
    }

    for (let a = 1; a <= ayahCount; a++) {
      const key = String(a);

      if (isIraab) {
        // Skip only ayahs already confirmed ("1" or "0"). A "?" bit means
        // the ayah is still unknown and must remain retryable.
        const bit = iraabAvailability![String(s)]?.charAt(a - 1);
        if (bit === "1" || bit === "0") continue;
      } else {
        // Skip if already scraped
        if (key in existing) continue;
        // Skip if covered by a group from an earlier entry
        if (coveredByGroup.has(a)) {
          existing[key] = null;
          modified = true;
          continue;
        }
      }

      try {
        const response = await fetchTafsir(sourceId, s, a);
        const data = response.data;

        if (isIraab) {
          if (data) {
            writeIraabVerse(s, a, data);
            setIraabAvailabilityBit(iraabAvailability!, s, a, true);
            saveIraabAvailability(iraabAvailability!);
          } else {
            // Fetched null → known unavailable. No per-verse file is written.
            setIraabAvailabilityBit(iraabAvailability!, s, a, false);
            saveIraabAvailability(iraabAvailability!);
          }
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
        // Don't record anything on error — leave it unknown for retry.
      }

      // Save after each ayah (non-iraab per-surah JSON only; iraab saves inline)
      if (!isIraab && modified) {
        saveJson(outPath!, existing);
        modified = false;
      }

      await sleep(randomDelay());
    }

    if (!isIraab && modified) saveJson(outPath!, existing);
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
