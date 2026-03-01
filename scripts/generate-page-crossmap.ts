/**
 * Generates a bidirectional V2 ↔ Indopak page cross-map.
 *
 * Output: public/data/page-map.v2-indopak.json
 *   { "v2ToIndopak": { "1": 1, "2": 1, ... }, "indopakToV2": { "1": 1, ... } }
 *
 * Algorithm:
 *   For each V2 page, find the first verse on that page, then look it up in
 *   the Indopak verse-pages map to get its Indopak page. Vice versa for
 *   Indopak → V2.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type VersePageLookup = number | [number, number];
type VersePageMap = Record<string, VersePageLookup>;

async function loadVersePages(mushafCode: string): Promise<VersePageMap> {
  const filePath = path.join(process.cwd(), "public", "data", `verse-pages.${mushafCode}.json`);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as VersePageMap;
}

function firstPageOf(lookup: VersePageLookup): number {
  return Array.isArray(lookup) ? lookup[0] : lookup;
}

async function main() {
  const v2Map = await loadVersePages("v2");
  const indopakMap = await loadVersePages("indopak");

  // Build page → first-verse maps (in Quran order, since JSON keys are insertion-ordered)
  const v2PageToFirstVerse = new Map<number, string>();
  for (const [vk, lookup] of Object.entries(v2Map)) {
    const page = firstPageOf(lookup);
    if (!v2PageToFirstVerse.has(page)) {
      v2PageToFirstVerse.set(page, vk);
    }
  }

  const indopakPageToFirstVerse = new Map<number, string>();
  for (const [vk, lookup] of Object.entries(indopakMap)) {
    const page = firstPageOf(lookup);
    if (!indopakPageToFirstVerse.has(page)) {
      indopakPageToFirstVerse.set(page, vk);
    }
  }

  // V2 → Indopak: for each V2 page, look up its first verse in indopakMap
  const v2ToIndopak: Record<number, number> = {};
  for (const [v2PageNum, firstVerse] of v2PageToFirstVerse.entries()) {
    const indopakLookup = indopakMap[firstVerse];
    if (indopakLookup != null) {
      v2ToIndopak[v2PageNum] = firstPageOf(indopakLookup);
    } else {
      // Fallback: find the nearest verse that exists in indopak
      v2ToIndopak[v2PageNum] = 1;
    }
  }

  // Indopak → V2: for each Indopak page, look up its first verse in v2Map
  const indopakToV2: Record<number, number> = {};
  for (const [indopakPageNum, firstVerse] of indopakPageToFirstVerse.entries()) {
    const v2Lookup = v2Map[firstVerse];
    if (v2Lookup != null) {
      indopakToV2[indopakPageNum] = firstPageOf(v2Lookup);
    } else {
      indopakToV2[indopakPageNum] = 1;
    }
  }

  const output = { v2ToIndopak, indopakToV2 };
  const outPath = path.join(process.cwd(), "public", "data", "page-map.v2-indopak.json");
  await writeFile(outPath, JSON.stringify(output));

  console.log(`Written: ${outPath}`);
  console.log(`  v2ToIndopak entries: ${Object.keys(v2ToIndopak).length}`);
  console.log(`  indopakToV2 entries: ${Object.keys(indopakToV2).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
