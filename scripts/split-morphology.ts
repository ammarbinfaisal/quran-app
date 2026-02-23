#!/usr/bin/env bun
/**
 * Splits public/data/morphology.json into 30 juz-based chunks
 * and generates a lemma index manifest.
 *
 * Output:
 *   public/data/morphology/juz-01.json … juz-30.json
 *   public/data/lemmas/index.json
 *
 * Usage:
 *   bun scripts/split-morphology.ts
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const DATA = join(ROOT, "public", "data");

// ---------------------------------------------------------------------------
// 1. Load juz page ranges + verse-pages map
// ---------------------------------------------------------------------------
const juzPages: { juz: number; pages: [number, number] }[] = JSON.parse(
  readFileSync(join(DATA, "juz-pages.madani.json"), "utf-8"),
);

const versePages: Record<string, number | [number, number]> = JSON.parse(
  readFileSync(join(DATA, "verse-pages.v2.json"), "utf-8"),
);

// Build a fast verse→juz lookup (based on page number)
function getJuz(surah: number, ayah: number): number {
  const vk = `${surah}:${ayah}`;
  const pageLookup = versePages[vk];
  if (pageLookup == null) return 1; // fallback
  const page = Array.isArray(pageLookup) ? pageLookup[0] : pageLookup;
  for (const jp of juzPages) {
    if (page >= jp.pages[0] && page <= jp.pages[1]) return jp.juz;
  }
  return 30; // fallback
}

// ---------------------------------------------------------------------------
// 2. Load morphology data and split by juz
// ---------------------------------------------------------------------------
type MorphEntry = unknown[];
const morphology: Record<string, MorphEntry> = JSON.parse(
  readFileSync(join(DATA, "morphology.json"), "utf-8"),
);

// Initialize 30 buckets
const buckets: Record<string, MorphEntry>[] = Array.from({ length: 30 }, () => ({}));

let count = 0;
for (const [key, value] of Object.entries(morphology)) {
  // key format: "surah:ayah:word"
  const parts = key.split(":");
  const surah = parseInt(parts[0], 10);
  const ayah = parseInt(parts[1], 10);
  const juz = getJuz(surah, ayah);
  buckets[juz - 1][key] = value;
  count++;
}

console.log(`Total morphology entries: ${count}`);

// ---------------------------------------------------------------------------
// 3. Write juz chunks
// ---------------------------------------------------------------------------
const morphDir = join(DATA, "morphology");
mkdirSync(morphDir, { recursive: true });

for (let i = 0; i < 30; i++) {
  const filename = `juz-${String(i + 1).padStart(2, "0")}.json`;
  const filepath = join(morphDir, filename);
  writeFileSync(filepath, JSON.stringify(buckets[i]));
  const entryCount = Object.keys(buckets[i]).length;
  console.log(`  ${filename}: ${entryCount} entries`);
}

// ---------------------------------------------------------------------------
// 4. Generate lemma index manifest
// ---------------------------------------------------------------------------
const lemmaDir = join(DATA, "lemmas");
const lemmaFiles = readdirSync(lemmaDir)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .sort();

writeFileSync(join(lemmaDir, "index.json"), JSON.stringify(lemmaFiles));
console.log(`\nLemma index: ${lemmaFiles.length} files`);
console.log("Done!");
