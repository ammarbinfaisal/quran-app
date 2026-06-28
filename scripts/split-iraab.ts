#!/usr/bin/env bun
/**
 * Splits public/data/iraab/{surah}.json (per-surah i3raab files) into a
 * per-verse store plus an availability manifest.
 *
 * Output:
 *   public/data/iraab/verses/{surah}/{ayah}.json   — only non-null SVG entries
 *   public/data/iraab/availability.json             — per-surah bitmaps
 *
 * Availability bitmap semantics (1-indexed by ayah):
 *   "1" — fetched and available (non-null SVG)
 *   "0" — fetched and known unavailable (explicit null)
 *   "?" — unknown gap inside a surah (key absent in old data) that is
 *          followed by a later known 0/1 entry; kept so re-scraping can
 *          retry it. Trailing unknown positions are omitted (short bitmap).
 *
 * A missing/short bitmap also means unknown.
 *
 * Each per-verse file is an object shape `{ "svg": "..." }` so future metadata
 * can be added without changing the runtime loader.
 *
 * Usage:
 *   bun scripts/split-iraab.ts
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const IRAAB_DIR = join(ROOT, "public", "data", "iraab");
const VERSES_DIR = join(IRAAB_DIR, "verses");
const AVAILABILITY_PATH = join(IRAAB_DIR, "availability.json");

// Total ayahs per surah (standard Madani count)
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54,
  45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62,
  55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

type AvailabilityMap = Record<string, string>;

function loadAvailability(): AvailabilityMap {
  if (!existsSync(AVAILABILITY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(AVAILABILITY_PATH, "utf-8")) as AvailabilityMap;
  } catch {
    return {};
  }
}

function buildBitmap(
  ayahCount: number,
  present: Set<number>,
  unavailable: Set<number>,
): string {
  // First pass: build a char per ayah using "1"/"0" for known positions and
  // "?" for unknown gaps (positions that are neither present nor marked
  // unavailable). Gaps can occur when the old data simply omits a key that
  // lies between known entries (e.g. surah 55 ayah 69).
  const chars: string[] = [];
  for (let a = 1; a <= ayahCount; a++) {
    if (present.has(a)) chars.push("1");
    else if (unavailable.has(a)) chars.push("0");
    else chars.push("?");
  }

  // Trim only trailing "?" unknowns. Known 0/1 entries beyond a gap must be
  // preserved, so we stop trimming at the last non-"?" char.
  let lastKnown = chars.length;
  while (lastKnown > 0 && chars[lastKnown - 1] === "?") lastKnown--;
  return chars.slice(0, lastKnown).join("");
}

function main() {
  if (!existsSync(IRAAB_DIR)) {
    console.error(`iraab dir not found: ${IRAAB_DIR}`);
    process.exit(1);
  }

  const surahFiles = readdirSync(IRAAB_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (surahFiles.length === 0) {
    // After migration, per-surah sources are deleted in favor of the split
    // store. Treat an existing split store as "already done" so the script is
    // idempotent and safe to re-run.
    const splitStoreExists =
      existsSync(AVAILABILITY_PATH) && existsSync(VERSES_DIR);
    if (splitStoreExists) {
      console.log(
        "Split iraab store already exists (availability.json + verses/). Nothing to do.",
      );
      process.exit(0);
    }
    console.error(
      "No per-surah iraab JSON files found to split, and no split store exists. Nothing to do.",
    );
    process.exit(1);
  }

  mkdirSync(VERSES_DIR, { recursive: true });

  // Start from existing availability so re-runs are idempotent and previously
  // marked-unavailable ayahs (fetched null) stay marked unless contradicted.
  const availability = loadAvailability();

  let totalVerses = 0;

  for (const file of surahFiles) {
    const surah = parseInt(file, 10);
    const ayahCount = SURAH_AYAH_COUNTS[surah - 1];
    if (!ayahCount) {
      console.warn(`  Unknown ayah count for surah ${surah}, skipping`);
      continue;
    }

    const raw = JSON.parse(
      readFileSync(join(IRAAB_DIR, file), "utf-8"),
    ) as Record<string, string | null>;

    const present = new Set<number>();
    const unavailable = new Set<number>();

    const surahVersesDir = join(VERSES_DIR, String(surah));
    mkdirSync(surahVersesDir, { recursive: true });

    const keys = Object.keys(raw)
      .map((k) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (const ayah of keys) {
      if (ayah < 1 || ayah > ayahCount) continue;
      const svg = raw[String(ayah)];
      if (typeof svg === "string" && svg.length > 0) {
        present.add(ayah);
        writeFileSync(
          join(surahVersesDir, `${ayah}.json`),
          JSON.stringify({ svg }),
        );
        totalVerses++;
      } else {
        // Explicitly null/empty in old data → known unavailable.
        unavailable.add(ayah);
      }
    }

    availability[String(surah)] = buildBitmap(ayahCount, present, unavailable);
    const keptBitmap = availability[String(surah)];
    console.log(
      `  surah ${surah}: ${present.size} available, ${unavailable.size} unavailable, bitmap length ${keptBitmap.length}/${ayahCount}`,
    );
  }

  mkdirSync(IRAAB_DIR, { recursive: true });
  writeFileSync(
    AVAILABILITY_PATH,
    JSON.stringify(availability, null, 2) + "\n",
  );

  console.log(`\nWrote ${totalVerses} per-verse files`);
  console.log(`Availability manifest: ${AVAILABILITY_PATH}`);
  console.log("Done!");
}

main();
