import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

type CompactSeg = string | { a: string };

interface AbuIyaadNote {
  number: string;
  noteId: string | null;
  text: string;
  author: string | null;
  reference: string | null;
  addedBy: string | null;
  addedOn: string | null;
}

const execFileAsync = promisify(execFile);

// Slow by default to be respectful. Set SCRAPE_FAST=1 for no delays.
const FAST_MODE = !!process.env.SCRAPE_FAST;
const TRANSLATION_DELAY_MS = FAST_MODE ? 0 : 100_000;
const NOTES_DELAY_MS = FAST_MODE ? 0 : 200_000;
const NOTES_CONCURRENCY = FAST_MODE ? 6 : 1;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ldquo: "\u201c",
  rdquo: "\u201d",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
};

const SURAH_VERSE_COUNTS = [
  0,
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

const QURAN_CUMULATIVE: number[] = [0];
for (let surah = 1; surah <= 114; surah++) {
  QURAN_CUMULATIVE[surah] = QURAN_CUMULATIVE[surah - 1] + SURAH_VERSE_COUNTS[surah];
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (match, entity) => {
    if (!entity) return match;
    if (entity[0] === "#") {
      const normalized = entity.toLowerCase();
      const codePoint = normalized.startsWith("#x")
        ? parseInt(normalized.slice(2), 16)
        : parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED[entity] ?? match;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const SPAN_RE = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;

function parseVerseHtml(html: string): CompactSeg[] {
  const segments: CompactSeg[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SPAN_RE.lastIndex = 0;
  while ((match = SPAN_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const raw = decodeEntities(stripTags(html.slice(lastIndex, match.index)));
      if (raw) segments.push(raw);
    }

    const annotation = normalizeWhitespace(decodeEntities(stripTags(match[1] ?? "")));
    if (annotation) segments.push({ a: annotation });

    lastIndex = SPAN_RE.lastIndex;
  }

  if (lastIndex < html.length) {
    const raw = decodeEntities(stripTags(html.slice(lastIndex)));
    if (raw) segments.push(raw);
  }

  return segments;
}

function parseNotesHtml(html: string): AbuIyaadNote[] {
  const $ = cheerio.load(html);

  return $("li.list-group-item")
    .map((_: number, element: Element) => {
      const item = $(element);
      const content = item.find(".col-11").first();
      if (content.length === 0) return null;

      const number = normalizeWhitespace(item.find(".chip.orange strong").first().text()) || "1";
      const noteId =
        item
          .find(".chip.green")
          .attr("onclick")
          ?.match(/#\/note\/(\d+)/)?.[1] ?? null;
      const text = normalizeWhitespace(content.children("span").first().text());
      if (!text) return null;

      const author = normalizeWhitespace(content.find("span.blue-text.font-weight-bold").first().text()) || null;
      const greySpans = content
        .find("span.grey-text")
        .map((__: number, span: Element) => normalizeWhitespace($(span).text()))
        .get()
        .filter(Boolean);
      const reference = greySpans[0] ?? null;
      const metadata = normalizeWhitespace(content.text()).match(/Added by:\s*(.+?)\s+on\s+(.+)$/);

      return {
        number,
        noteId,
        text,
        author,
        reference,
        addedBy: metadata?.[1] ?? null,
        addedOn: metadata?.[2] ?? null,
      } satisfies AbuIyaadNote;
    })
    .get()
    .filter((note: AbuIyaadNote | null): note is AbuIyaadNote => note !== null);
}

async function resolveCurlChromeExecutable(): Promise<string> {
  const fromEnv = process.env.CURL_CHROME_BIN;
  if (fromEnv) {
    return fromEnv.startsWith("~/") ? join(homedir(), fromEnv.slice(2)) : fromEnv;
  }

  const dir = join(homedir(), "curl_chrome");
  const candidates = (await readdir(dir))
    .filter((entry: string) => /^curl_chrome\d+$/.test(entry))
    .sort((a, b) => Number.parseInt(b.slice("curl_chrome".length), 10) - Number.parseInt(a.slice("curl_chrome".length), 10));

  if (candidates.length === 0) {
    throw new Error(`No curl_chrome* executable found in ${dir}`);
  }

  return join(dir, candidates[0]);
}

async function runCurlChrome(
  executable: string,
  cookieFile: string,
  url: string,
  headers: string[] = [],
): Promise<string> {
  const args = [
    "-sS",
    "-L",
    "-b",
    cookieFile,
    "-c",
    cookieFile,
    ...headers.flatMap((header) => ["-H", header]),
    url,
  ];
  const { stdout } = await execFileAsync(executable, args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

async function initSession(executable: string, cookieFile: string): Promise<void> {
  await execFileAsync(
    executable,
    ["-sS", "-L", "-c", cookieFile, "https://www.thenoblequran.com/q/"],
    { maxBuffer: 8 * 1024 * 1024 },
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function run() {
  const translationResult: Record<string, CompactSeg[]> = {};
  const notesResult: Record<string, AbuIyaadNote[]> = {};

  const executable = await resolveCurlChromeExecutable();
  const tempDir = await mkdtemp(join(tmpdir(), "abu-iyaad-"));
  const cookieFile = join(tempDir, "cookies.txt");

  try {
    console.log(`Using ${executable}`);
    console.log(FAST_MODE
      ? "Fast mode (no delays)"
      : `Slow mode: ${TRANSLATION_DELAY_MS / 1000}s between translation pages, ${NOTES_DELAY_MS / 1000}s between notes (concurrency ${NOTES_CONCURRENCY})`,
    );
    console.log("Establishing session...");
    await initSession(executable, cookieFile);
    console.log("Session ready. Starting translation scrape...");

    for (let surah = 1; surah <= 114; surah++) {
      process.stdout.write(`Fetching sura ${surah}...`);
      let start = 1;
      let keepGoing = true;

      while (keepGoing) {
        try {
          const url = `https://www.thenoblequran.com/q/includes/cfm/displaysura.cfm?sura=${surah}&start=${start}`;
          const html = await runCurlChrome(executable, cookieFile, url, [
            "accept: text/html, */*; q=0.01",
            "referer: https://www.thenoblequran.com/q/",
          ]);

          if (html.trim().length === 0 || html.includes("No verses found")) {
            keepGoing = false;
            break;
          }

          const $ = cheerio.load(html);
          const prevCum = QURAN_CUMULATIVE[surah - 1];
          let foundAny = false;

          $("[id^='rafiam']").each((_: number, element: Element) => {
            const id = $(element).attr("id");
            const match = id?.match(/^rafiam(\d+)$/);
            if (!match) return;

            const quranPosition = Number.parseInt(match[1], 10);
            const ayah = quranPosition - prevCum;
            if (ayah < 1 || ayah > SURAH_VERSE_COUNTS[surah]) return;

            const segments = parseVerseHtml(($(element).html() ?? "").replace(/\s+/g, " "));
            if (segments.length === 0) return;

            translationResult[`${surah}:${ayah}`] = segments;
            foundAny = true;
          });

          if (!foundAny) {
            keepGoing = false;
          } else {
            start += 10;
            await sleep(TRANSLATION_DELAY_MS);
          }
        } catch (error) {
          console.error(`\nError fetching sura ${surah} start ${start}:`, error);
          keepGoing = false;
        }
      }

      console.log(" Done.");
    }

    const verseKeys = Object.keys(translationResult).sort((a, b) => {
      const [aSurah, aAyah] = a.split(":").map(Number);
      const [bSurah, bAyah] = b.split(":").map(Number);
      return aSurah - bSurah || aAyah - bAyah;
    });

    console.log(`Scraping notes for ${verseKeys.length} verses...`);

    await mapWithConcurrency(verseKeys, NOTES_CONCURRENCY, async (verseKey, index) => {
      const query = verseKey.replace(":", "_");
      const url = `https://www.thenoblequran.com/q/includes/cfm/search.cfm?q=${query}&shownotes=1`;

      try {
        const html = await runCurlChrome(executable, cookieFile, url, [
          "accept: text/html, */*; q=0.01",
          "referer: https://www.thenoblequran.com/q/",
          "x-requested-with: XMLHttpRequest",
        ]);
        const notes = parseNotesHtml(html);
        if (notes.length > 0) {
          notesResult[verseKey] = notes;
        }
      } catch (error) {
        console.error(`Failed to fetch notes for ${verseKey}:`, error);
      }

      if ((index + 1) % 100 === 0 || index + 1 === verseKeys.length) {
        console.log(`Processed ${index + 1}/${verseKeys.length} note pages`);
      }

      await sleep(NOTES_DELAY_MS);
    });

    const publicDataDir = join(process.cwd(), "public", "data");
    await writeFile(join(publicDataDir, "abu-iyaad.json"), JSON.stringify(translationResult));
    await writeFile(join(publicDataDir, "abu-iyaad-notes.json"), JSON.stringify(notesResult));

    console.log(`Saved ${verseKeys.length} translation keys and ${Object.keys(notesResult).length} note keys.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
