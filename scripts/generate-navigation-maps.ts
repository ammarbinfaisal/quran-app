import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JUZ_PAGE_RANGES } from "../src/lib/juz";

type VerseKey = `${number}:${number}`;

type VersePages = Record<VerseKey, number | [number, number]>;

type MushafWord = { verseKey?: string | null };
type MushafLine = { words: MushafWord[] };
type MushafPage = { page: number; lines: MushafLine[] };

function isVerseKey(value: string): value is VerseKey {
  return /^\d+:\d+$/.test(value);
}

function toVerseKey(raw: string): VerseKey | null {
  return isVerseKey(raw) ? raw : null;
}

function parsePageFileName(fileName: string): number | null {
  const m = /^p(\d{3})\.json$/.exec(fileName);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function loadMushafPages(dir: string): Promise<MushafPage[]> {
  const entries = await readdir(dir);
  const pageFiles = entries
    .map((name) => ({ name, page: parsePageFileName(name) }))
    .filter((x): x is { name: string; page: number } => x.page != null)
    .sort((a, b) => a.page - b.page);

  const pages: MushafPage[] = [];
  for (const f of pageFiles) {
    const raw = await readFile(path.join(dir, f.name), "utf8");
    const parsed = JSON.parse(raw) as MushafPage;
    pages.push(parsed);
  }
  return pages;
}

function buildVersePagesMap(pages: MushafPage[]): {
  versePages: VersePages;
  spanning: Array<{ verseKey: VerseKey; pages: number[] }>;
  invalid: Array<{ page: number; verseKey: string }>;
} {
  const verseToPages = new Map<VerseKey, Set<number>>();
  const invalid: Array<{ page: number; verseKey: string }> = [];

  for (const p of pages) {
    for (const line of p.lines ?? []) {
      for (const word of line.words ?? []) {
        const vkRaw = word.verseKey;
        if (!vkRaw) continue;
        const vk = toVerseKey(vkRaw);
        if (!vk) {
          invalid.push({ page: p.page, verseKey: String(vkRaw) });
          continue;
        }
        const existing = verseToPages.get(vk) ?? new Set<number>();
        existing.add(p.page);
        verseToPages.set(vk, existing);
      }
    }
  }

  const versePages: VersePages = Object.create(null);
  const spanning: Array<{ verseKey: VerseKey; pages: number[] }> = [];

  for (const [vk, pageSet] of verseToPages.entries()) {
    const pagesList = Array.from(pageSet).sort((a, b) => a - b);
    if (pagesList.length === 1) {
      versePages[vk] = pagesList[0]!;
    } else {
      spanning.push({ verseKey: vk, pages: pagesList });
      versePages[vk] = [pagesList[0]!, pagesList[pagesList.length - 1]!];
    }
  }

  spanning.sort((a, b) => (a.pages[0] ?? 0) - (b.pages[0] ?? 0));

  return { versePages, spanning, invalid };
}

function buildSurahPageRanges(versePages: VersePages): Array<{
  surah: number;
  pages: [number, number];
}> {
  const rangeBySurah = new Map<number, { start: number; end: number }>();

  for (const [verseKey, pageOrSpan] of Object.entries(versePages)) {
    const [surahRaw] = verseKey.split(":");
    const surah = Number(surahRaw);
    if (!Number.isFinite(surah)) continue;

    const pages = Array.isArray(pageOrSpan)
      ? pageOrSpan
      : [pageOrSpan, pageOrSpan];
    const start = pages[0]!;
    const end = pages[1]!;

    const existing = rangeBySurah.get(surah);
    if (!existing) {
      rangeBySurah.set(surah, { start, end });
    } else {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    }
  }

  const out: Array<{ surah: number; pages: [number, number] }> = [];
  for (let surah = 1; surah <= 114; surah++) {
    const r = rangeBySurah.get(surah);
    if (!r) continue;
    out.push({ surah, pages: [r.start, r.end] });
  }
  return out;
}

async function main() {
  const mushafCode = process.argv.includes("--code")
    ? (process.argv[process.argv.indexOf("--code") + 1] ?? "v2")
    : "v2";

  const mushafDir = path.join(process.cwd(), "public", "mushaf-data", mushafCode);
  const outDir = path.join(process.cwd(), "public", "data");

  console.log(`Generating maps from ${mushafDir}…`);
  const pages = await loadMushafPages(mushafDir);
  const { versePages, spanning, invalid } = buildVersePagesMap(pages);

  const spansOverTwoPages = spanning.filter((s) => s.pages.length > 2);
  if (spansOverTwoPages.length > 0) {
    console.warn(
      `WARNING: Found ${spansOverTwoPages.length} verses spanning >2 pages (unexpected).`,
    );
  } else {
    console.log(`OK: No verses span >2 pages.`);
  }

  if (spanning.length > 0) {
    console.log(`Info: ${spanning.length} verses span multiple pages.`);
  }
  if (invalid.length > 0) {
    console.warn(`WARNING: Found ${invalid.length} invalid verseKey values.`);
  }

  const surahPages = buildSurahPageRanges(versePages);

  await writeFile(
    path.join(outDir, `verse-pages.${mushafCode}.json`),
    JSON.stringify(versePages),
  );
  await writeFile(
    path.join(outDir, `surah-pages.${mushafCode}.json`),
    JSON.stringify(surahPages),
  );

  await writeFile(
    path.join(outDir, "juz-pages.madani.json"),
    JSON.stringify(JUZ_PAGE_RANGES),
  );

  console.log("Wrote:");
  console.log(
    `- public/data/verse-pages.${mushafCode}.json (${Object.keys(versePages).length} verses)`,
  );
  console.log(
    `- public/data/surah-pages.${mushafCode}.json (${surahPages.length} surahs)`,
  );
  console.log(`- public/data/juz-pages.madani.json (${JUZ_PAGE_RANGES.length} juz)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
