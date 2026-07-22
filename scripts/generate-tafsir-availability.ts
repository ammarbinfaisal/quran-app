/**
 * Scans every scraped tafsir surah JSON and emits a compact availability
 * manifest so the UI can hide switcher buttons for ayahs without data
 * without downloading the full surah files.
 *
 * Output: public/data/tafsir/availability.json
 *
 * Schema:
 *   { [tafsirId]: { [surahId]: string } }
 *   where each string is a bitmap ('1' / '0') indexed by ayah 1..N.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import path from "path";

const TAFSIR_IDS = [
  "ibn-katheer",
  "tabari",
  "qurtubi",
  "baghawi",
  "ibn-uthaymeen",
  "ibn-alqayyim",
  "adwaa-albayan",
] as const;

type TafsirId = (typeof TAFSIR_IDS)[number];

// Standard Madani ayah counts.
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
  26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

interface TafsirEntry {
  text?: string;
  ayahsStart?: number;
  count?: number;
}

type SurahFile = Record<string, TafsirEntry | null>;

function computeSurahBitmap(file: SurahFile, totalAyahs: number): string {
  const covered = new Array<boolean>(totalAyahs).fill(false);

  // First pass: every ayah that has a non-null entry with text or ayahsStart
  // counts as covered.
  for (const [key, entry] of Object.entries(file)) {
    const ayah = Number.parseInt(key, 10);
    if (!Number.isFinite(ayah) || ayah < 1 || ayah > totalAyahs) continue;
    if (entry === null) continue;
    if (entry.text) covered[ayah - 1] = true;
  }

  // Second pass: propagate grouped ranges so ayahs explicitly null'd under a
  // group are also flagged as covered.
  for (const entry of Object.values(file)) {
    if (!entry) continue;
    const start = entry.ayahsStart;
    const count = entry.count;
    if (start == null || count == null || count < 1) continue;
    if (!entry.text) continue;
    for (let i = 0; i < count; i++) {
      const ayah = start + i;
      if (ayah >= 1 && ayah <= totalAyahs) covered[ayah - 1] = true;
    }
  }

  return covered.map((flag) => (flag ? "1" : "0")).join("");
}

function buildForTafsir(tafsirId: TafsirId): Record<string, string> {
  const dir = path.join(process.cwd(), "public/data/tafsir", tafsirId);
  if (!existsSync(dir)) {
    console.warn(`[warn] missing directory: ${dir}`);
    return {};
  }

  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  const result: Record<string, string> = {};

  for (const file of files) {
    const surah = Number.parseInt(path.basename(file, ".json"), 10);
    if (!Number.isFinite(surah) || surah < 1 || surah > 114) continue;
    const total = SURAH_AYAH_COUNTS[surah - 1];
    if (!total) continue;

    let data: SurahFile;
    try {
      data = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as SurahFile;
    } catch (error) {
      console.warn(`[warn] failed to parse ${path.join(dir, file)}:`, error);
      continue;
    }

    result[String(surah)] = computeSurahBitmap(data, total);
  }

  return result;
}

function main() {
  const manifest: Record<string, Record<string, string>> = {};
  let totalCovered = 0;
  let totalAyahs = 0;

  for (const id of TAFSIR_IDS) {
    const data = buildForTafsir(id);
    manifest[id] = data;

    let covered = 0;
    let seen = 0;
    for (const bitmap of Object.values(data)) {
      seen += bitmap.length;
      for (const ch of bitmap) if (ch === "1") covered++;
    }
    console.log(
      `  ${id}: ${covered}/${seen} ayahs covered (${((covered / seen) * 100).toFixed(1)}%)`,
    );
    totalCovered += covered;
    totalAyahs += seen;
  }

  const outPath = path.join(
    process.cwd(),
    "public/data/tafsir/availability.json",
  );
  writeFileSync(outPath, JSON.stringify(manifest));
  console.log(
    `\nwrote ${outPath} (${totalCovered}/${totalAyahs} ayahs covered across all tafsirs)`,
  );
}

main();
