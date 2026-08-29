/**
 * Builds public/data/search-index.bin — the precomputed word-suffix index that
 * backs /api/search and offline search. See src/lib/search/format.ts for the
 * layout and src/lib/search/engine.ts for how it is queried.
 *
 * Usage: bun scripts/generate-search-index.ts
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeArabic } from "../src/lib/search/normalize";
import {
  CODE_SEPARATOR,
  CODE_SPACE,
  encodeSearchIndex,
  parseSearchIndex,
} from "../src/lib/search/format";
import { SEARCH_INDEX_FILE } from "../src/lib/search/constants";

const SOURCE = path.join(process.cwd(), "rust-api", "data", "quran-uthmani.json");
const OUTPUT = path.join(process.cwd(), SEARCH_INDEX_FILE);

interface VerseRecord {
  verse_key: string;
  surah: number;
  ayah: number;
  text_uthmani: string;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as { verses: VerseRecord[] };
  const verses = raw.verses;
  const V = verses.length;
  if (V === 0) throw new Error("no verses in source");

  // 1. Normalize and build the alphabet (sorted code points; 0 = separator, 1 = space).
  const normalized = verses.map((v) => normalizeArabic(v.text_uthmani));
  const cps = new Set<number>();
  for (const text of normalized) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp !== 0x20) cps.add(cp);
    }
  }
  const letters = [...cps].sort((a, b) => a - b);
  const alphabet = Uint16Array.from([0, 0x20, ...letters]);
  const A = alphabet.length;
  if (A > 255) throw new Error(`alphabet too large for Uint8 codes: ${A}`);
  const codeOf = new Map<number, number>();
  alphabet.forEach((cp, code) => codeOf.set(cp, code));

  // 2. Encode the corpus; every verse ends with a separator.
  let N = 0;
  for (const text of normalized) N += [...text].length + 1;
  const text = new Uint8Array(N);
  const verseStart = new Uint32Array(V + 1);
  const surah = new Uint8Array(V);
  const ayah = new Uint16Array(V);
  let pos = 0;
  normalized.forEach((t, i) => {
    verseStart[i] = pos;
    surah[i] = verses[i].surah;
    ayah[i] = verses[i].ayah;
    for (const ch of t) text[pos++] = codeOf.get(ch.codePointAt(0)!)!;
    text[pos++] = CODE_SEPARATOR;
  });
  verseStart[V] = N;
  if (pos !== N) throw new Error("corpus length mismatch");

  // 3. Word starts → word-suffix array.
  const starts: number[] = [];
  for (let p = 0; p < N; p++) {
    const c = text[p];
    if (c === CODE_SEPARATOR || c === CODE_SPACE) continue;
    const prev = p === 0 ? CODE_SEPARATOR : text[p - 1];
    if (prev === CODE_SEPARATOR || prev === CODE_SPACE) starts.push(p);
  }
  const W = starts.length;
  if (V > 0xffff) throw new Error("too many verses for Uint16 saVerse");

  starts.sort((p, q) => {
    for (let i = 0; ; i++) {
      const a = text[p + i];
      const b = text[q + i];
      if (a !== b) return a - b;
      if (a === CODE_SEPARATOR) return p - q; // both suffixes ended at the same length
    }
  });
  const sa = Uint32Array.from(starts);

  // verse index for each word start (positions are ascending per verse, so a running cursor works)
  const verseOfPos = new Uint16Array(N);
  for (let v = 0; v < V; v++) verseOfPos.fill(v, verseStart[v], verseStart[v + 1]);
  const saVerse = new Uint16Array(W);
  for (let k = 0; k < W; k++) saVerse[k] = verseOfPos[sa[k]];

  // 4. Prefix tree (depth 1 and 2) as [lo,hi) ranges into sa. sa is sorted by code
  //    order, so each (c0) and (c0,c1) group is contiguous: count then prefix-sum.
  const count1 = new Uint32Array(A);
  const count2 = new Uint32Array(A * A);
  for (let k = 0; k < W; k++) {
    const p = sa[k];
    const c0 = text[p];
    const c1 = text[p + 1];
    count1[c0]++;
    count2[c0 * A + c1]++;
  }
  const prefix1 = new Uint32Array(2 * A);
  const prefix2 = new Uint32Array(2 * A * A);
  let cursor = 0;
  for (let c0 = 0; c0 < A; c0++) {
    prefix1[2 * c0] = cursor;
    for (let c1 = 0; c1 < A; c1++) {
      const node = c0 * A + c1;
      prefix2[2 * node] = cursor;
      cursor += count2[node];
      prefix2[2 * node + 1] = cursor;
    }
    prefix1[2 * c0 + 1] = cursor;
    if (cursor - prefix1[2 * c0] !== count1[c0]) throw new Error("prefix table mismatch");
  }
  if (cursor !== W) throw new Error("prefix table did not cover sa");

  // 5. Encode, round-trip check, write.
  const buffer = encodeSearchIndex({ alphabet, text, verseStart, surah, ayah, sa, saVerse, prefix1, prefix2 });
  const parsed = parseSearchIndex(buffer);
  if (parsed.sa.length !== W || parsed.verseCount !== V) throw new Error("round-trip check failed");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, new Uint8Array(buffer));

  console.log(
    `search index: ${V} verses, ${N} chars, alphabet ${A}, ${W} word starts → ${path.relative(process.cwd(), OUTPUT)} (${(buffer.byteLength / 1024).toFixed(0)} KB)`,
  );
}

main();
