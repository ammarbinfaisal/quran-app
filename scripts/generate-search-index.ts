/**
 * Builds public/data/search-index.bin — the precomputed word-suffix index that
 * backs /api/search and offline search. See src/lib/search/format.ts for the
 * layout and src/lib/search/engine.ts for how it is queried.
 *
 * Usage: bun scripts/generate-search-index.ts
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeArabicWithElisions } from "../src/lib/search/normalize";
import {
  CODE_SEPARATOR,
  CODE_SPACE,
  encodeSearchIndex,
  isSegmentStart,
  parseSearchIndex,
  segStartByteLength,
} from "../src/lib/search/format";
import { SEARCH_INDEX_FILE } from "../src/lib/search/constants";
import { alignSegmentStarts, verseSegments, type MorphologySegment } from "../src/lib/search/segments";

const SOURCE = path.join(process.cwd(), "rust-api", "data", "quran-uthmani.json");
const MORPHOLOGY = path.join(process.cwd(), "public", "data", "morphology.json");
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
  const segments = verseSegments(
    JSON.parse(fs.readFileSync(MORPHOLOGY, "utf8")) as Record<string, MorphologySegment[]>,
  );

  // 1. Normalize and build the alphabet (sorted code points; 0 = separator, 1 = space).
  const normalizedVerses = verses.map((v) => normalizeArabicWithElisions(v.text_uthmani));
  const normalized = normalizedVerses.map((n) => n.text);
  const cps = new Set<number>();
  for (const text of normalized) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp !== 0x20) cps.add(cp);
    }
  }
  for (const n of normalizedVerses) for (const e of n.elisions) cps.add(e.letter.codePointAt(0)!);
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

  // 3. Segment alignment: every word start is a segment start; inside words the
  //    Quranic Arabic Corpus tells us where prefixes, stems and suffixes begin
  //    (وما → و|ما). Prefix and stem starts are match candidates (ما finds وما,
  //    الحمد finds والحمد, but هم does not find ربهم); all segment starts may
  //    absorb a query space.
  const wordStart = new Set<number>();
  for (let p = 0; p < N; p++) {
    const c = text[p];
    if (c === CODE_SEPARATOR || c === CODE_SPACE) continue;
    const prev = p === 0 ? CODE_SEPARATOR : text[p - 1];
    if (prev === CODE_SEPARATOR || prev === CODE_SPACE) wordStart.add(p);
  }
  const segStart = new Uint8Array(segStartByteLength(N));
  const setBit = (p: number) => {
    segStart[p >>> 3] |= 1 << (p & 7);
  };
  for (const p of wordStart) setBit(p);

  const innerMatchStarts = new Set<number>();
  let alignedVerses = 0;
  let partialVerses = 0;
  let innerBoundaries = 0;
  const failed: string[] = [];
  normalized.forEach((t, i) => {
    const verseSegs = segments.get(verses[i].verse_key);
    const alignment = verseSegs ? alignSegmentStarts(t, verseSegs.map((s) => s.form)) : null;
    if (!alignment || !verseSegs) {
      failed.push(verses[i].verse_key);
      return;
    }
    alignedVerses++;
    const length = [...t].length;
    if (alignment.consumed < length) partialVerses++;
    const base = verseStart[i];
    alignment.starts.forEach((offset, j) => {
      if (offset >= length) return;
      const p = base + offset;
      if (wordStart.has(p)) return;
      if (!isSegmentStart({ segStart }, p)) {
        setBit(p);
        innerBoundaries++;
      }
      if (!verseSegs[j].suffix) innerMatchStarts.add(p);
    });
  });
  if (failed.length > V * 0.01) {
    throw new Error(`segment alignment failed for ${failed.length} verses: ${failed.slice(0, 20).join(", ")}`);
  }

  // 4. Match starts (word starts ∪ inner prefix/stem starts) → suffix array.
  const starts = [...wordStart, ...innerMatchStarts];
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

  // 5. Prefix tree (depth 1 and 2) as [lo,hi) ranges into sa. sa is sorted by code
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

  // 6. Elided letters (dagger alef etc.), as ascending text positions.
  const elidedPosList: number[] = [];
  const elidedCodeList: number[] = [];
  normalizedVerses.forEach((n, i) => {
    for (const e of n.elisions) {
      elidedPosList.push(verseStart[i] + e.offset);
      elidedCodeList.push(codeOf.get(e.letter.codePointAt(0)!)!);
    }
  });
  const elidedPos = Uint32Array.from(elidedPosList);
  const elidedCode = Uint8Array.from(elidedCodeList);

  // 7. Encode, round-trip check, write.
  const buffer = encodeSearchIndex({
    alphabet,
    text,
    verseStart,
    surah,
    ayah,
    sa,
    saVerse,
    prefix1,
    prefix2,
    segStart,
    elidedPos,
    elidedCode,
  });
  const parsed = parseSearchIndex(buffer);
  if (parsed.sa.length !== W || parsed.verseCount !== V) throw new Error("round-trip check failed");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, new Uint8Array(buffer));

  console.log(
    `search index: ${V} verses, ${N} chars, alphabet ${A}, ${wordStart.size} word starts + ${innerMatchStarts.size} inner prefix/stem starts, ${innerBoundaries} inner segment boundaries, ${elidedPos.length} elided letters → ${path.relative(process.cwd(), OUTPUT)} (${(buffer.byteLength / 1024).toFixed(0)} KB)`,
  );
  console.log(
    `segments: ${alignedVerses}/${V} verses aligned (${partialVerses} with trailing text the corpus lacks)` +
      (failed.length ? `; word boundaries only for ${failed.length}: ${failed.join(", ")}` : ""),
  );
}

main();
