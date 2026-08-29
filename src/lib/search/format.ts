/**
 * Binary layout of public/data/search-index.bin.
 *
 * Everything is little-endian and each section is 4-byte aligned so the
 * parser can hand out typed-array views over the file without copying.
 *
 *   header      Uint32[6]   magic "QSI1", version, A, N, V, W
 *   alphabet    Uint16[A]   code -> code point (code 0 = verse separator, 1 = space)
 *   text        Uint8[N]    normalized corpus as codes; verses end with code 0
 *   verseStart  Uint32[V+1] verse i spans text[verseStart[i], verseStart[i+1] - 1)   ("ranges")
 *   surah       Uint8[V]
 *   ayah        Uint16[V]
 *   sa          Uint32[W]   word-suffix array: word-start positions sorted by following suffix
 *   saVerse     Uint16[W]   verse index of each sa entry
 *   prefix1     Uint32[2A]  [lo,hi) range in sa for each first code                  ("tree", depth 1)
 *   prefix2     Uint32[2A²] [lo,hi) range in sa for each (first, second) code pair    ("tree", depth 2)
 */

export const SEARCH_INDEX_MAGIC = 0x31495351; // "QSI1" as little-endian u32
export const SEARCH_INDEX_VERSION = 1;

/** Reserved codes in the text/alphabet. */
export const CODE_SEPARATOR = 0;
export const CODE_SPACE = 1;

export interface SearchIndex {
  /** code -> code point */
  alphabet: Uint16Array;
  /** code point -> code */
  codeOf: Map<number, number>;
  text: Uint8Array;
  verseStart: Uint32Array;
  surah: Uint8Array;
  ayah: Uint16Array;
  sa: Uint32Array;
  saVerse: Uint16Array;
  prefix1: Uint32Array;
  prefix2: Uint32Array;
  verseCount: number;
}

export interface SearchIndexData {
  alphabet: Uint16Array;
  text: Uint8Array;
  verseStart: Uint32Array;
  surah: Uint8Array;
  ayah: Uint16Array;
  sa: Uint32Array;
  saVerse: Uint16Array;
  prefix1: Uint32Array;
  prefix2: Uint32Array;
}

const HEADER_WORDS = 6;

function align4(n: number): number {
  return (n + 3) & ~3;
}

export function encodeSearchIndex(data: SearchIndexData): ArrayBuffer {
  const A = data.alphabet.length;
  const N = data.text.length;
  const V = data.surah.length;
  const W = data.sa.length;

  if (data.verseStart.length !== V + 1) throw new Error("verseStart must have V+1 entries");
  if (data.ayah.length !== V) throw new Error("ayah must have V entries");
  if (data.saVerse.length !== W) throw new Error("saVerse must have W entries");
  if (data.prefix1.length !== 2 * A) throw new Error("prefix1 must have 2A entries");
  if (data.prefix2.length !== 2 * A * A) throw new Error("prefix2 must have 2A² entries");

  const sections: Array<Uint8Array | Uint16Array | Uint32Array> = [
    data.alphabet,
    data.text,
    data.verseStart,
    data.surah,
    data.ayah,
    data.sa,
    data.saVerse,
    data.prefix1,
    data.prefix2,
  ];

  let total = HEADER_WORDS * 4;
  for (const s of sections) total += align4(s.byteLength);

  const buffer = new ArrayBuffer(total);
  const header = new Uint32Array(buffer, 0, HEADER_WORDS);
  header.set([SEARCH_INDEX_MAGIC, SEARCH_INDEX_VERSION, A, N, V, W]);

  const bytes = new Uint8Array(buffer);
  let offset = HEADER_WORDS * 4;
  for (const s of sections) {
    bytes.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), offset);
    offset += align4(s.byteLength);
  }
  return buffer;
}

export function parseSearchIndex(buffer: ArrayBuffer): SearchIndex {
  if (buffer.byteLength < HEADER_WORDS * 4) throw new Error("search index: truncated header");
  const header = new Uint32Array(buffer, 0, HEADER_WORDS);
  if (header[0] !== SEARCH_INDEX_MAGIC) throw new Error("search index: bad magic");
  if (header[1] !== SEARCH_INDEX_VERSION) {
    throw new Error(`search index: unsupported version ${header[1]}`);
  }
  const [, , A, N, V, W] = header;

  let offset = HEADER_WORDS * 4;
  function take<T extends Uint8Array | Uint16Array | Uint32Array>(
    ctor: new (buf: ArrayBuffer, byteOffset: number, length: number) => T,
    length: number,
    bytesPerElement: number,
  ): T {
    const byteLength = length * bytesPerElement;
    if (offset + byteLength > buffer.byteLength) throw new Error("search index: truncated section");
    const view = new ctor(buffer, offset, length);
    offset += align4(byteLength);
    return view;
  }

  const alphabet = take(Uint16Array, A, 2);
  const text = take(Uint8Array, N, 1);
  const verseStart = take(Uint32Array, V + 1, 4);
  const surah = take(Uint8Array, V, 1);
  const ayah = take(Uint16Array, V, 2);
  const sa = take(Uint32Array, W, 4);
  const saVerse = take(Uint16Array, W, 2);
  const prefix1 = take(Uint32Array, 2 * A, 4);
  const prefix2 = take(Uint32Array, 2 * A * A, 4);

  const codeOf = new Map<number, number>();
  for (let code = 0; code < A; code++) codeOf.set(alphabet[code], code);

  return {
    alphabet,
    codeOf,
    text,
    verseStart,
    surah,
    ayah,
    sa,
    saVerse,
    prefix1,
    prefix2,
    verseCount: V,
  };
}
