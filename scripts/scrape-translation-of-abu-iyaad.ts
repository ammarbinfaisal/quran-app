import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

const USER_AGENT = "quran.tarteel.tv (scraper)";

// Slow by default to be respectful. Set SCRAPE_FAST=1 for no delays.
// SCRAPE_TRANSLATION_DELAY_MS / SCRAPE_NOTES_DELAY_MS / SCRAPE_NOTES_CONCURRENCY
// override the defaults, so a full re-scrape can pick a polite middle ground
// instead of choosing between ~17 hours and hammering the site.
const FAST_MODE = !!process.env.SCRAPE_FAST;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const TRANSLATION_DELAY_MS = envInt(
  "SCRAPE_TRANSLATION_DELAY_MS",
  FAST_MODE ? 0 : 100_000,
);
const NOTES_DELAY_MS = envInt("SCRAPE_NOTES_DELAY_MS", FAST_MODE ? 0 : 200_000);
const NOTES_CONCURRENCY = Math.max(
  1,
  envInt("SCRAPE_NOTES_CONCURRENCY", FAST_MODE ? 6 : 1),
);

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

// Where curl-impersonate wrappers usually live. A system-wide install wins over
// a copy unpacked in $HOME, and the highest Chrome version in a directory wins.
const CURL_CHROME_SEARCH_DIRS = [
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/usr/bin",
  join(homedir(), "curl_chrome"),
];

async function findCurlChromeIn(dir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  const candidates = entries
    .filter((entry: string) => /^curl_chrome\d+$/.test(entry))
    .sort(
      (a, b) =>
        Number.parseInt(b.slice("curl_chrome".length), 10) -
        Number.parseInt(a.slice("curl_chrome".length), 10),
    );

  return candidates.length > 0 ? join(dir, candidates[0]) : null;
}

async function resolveCurlChromeExecutable(): Promise<string> {
  const fromEnv = process.env.CURL_CHROME_BIN;
  if (fromEnv) {
    return fromEnv.startsWith("~/") ? join(homedir(), fromEnv.slice(2)) : fromEnv;
  }

  for (const dir of CURL_CHROME_SEARCH_DIRS) {
    const found = await findCurlChromeIn(dir);
    if (found) return found;
  }

  throw new Error(
    `No curl_chrome* executable found in any of: ${CURL_CHROME_SEARCH_DIRS.join(", ")}. ` +
      `Install curl-impersonate or set CURL_CHROME_BIN.`,
  );
}

// A curl_chrome* wrapper already passes a full set of Chrome headers. Adding our
// own accept/user-agent on top sends them twice, and the site's IIS front end
// answers that with "HTTP Error 400. The request is badly formed." — every page
// comes back empty. Only forward headers the wrapper does not already set.
const IMPERSONATION_OWNED_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "user-agent",
]);

function isImpersonationWrapper(executable: string): boolean {
  return /curl_(chrome|edge|safari)/.test(executable);
}

async function runCurlChrome(
  executable: string,
  cookieFile: string,
  url: string,
  headers: string[] = [],
): Promise<string> {
  const effectiveHeaders = isImpersonationWrapper(executable)
    ? headers.filter((header) => {
        const name = header.split(":")[0]?.trim().toLowerCase();
        return name ? !IMPERSONATION_OWNED_HEADERS.has(name) : true;
      })
    : headers;

  const args = [
    "-sS",
    "-L",
    "-b",
    cookieFile,
    "-c",
    cookieFile,
    ...effectiveHeaders.flatMap((header) => ["-H", header]),
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

      // The translation is partial and its gaps fall mid-surah: al-Baqarah has
      // 2:1-24, then nothing until 2:41, then more up to 2:286. Paging until the
      // first empty page therefore stops at the first gap and silently discards
      // everything after it — this is what truncated the data in f8f34259.
      // Walk the whole surah by verse count instead, and let empty pages pass.
      while (keepGoing && start <= SURAH_VERSE_COUNTS[surah]) {
        try {
          const url = `https://www.thenoblequran.com/q/includes/cfm/displaysura.cfm?sura=${surah}&start=${start}`;
          const html = await runCurlChrome(executable, cookieFile, url, [
            "accept: text/html, */*; q=0.01",
            "referer: https://www.thenoblequran.com/q/",
            `user-agent: ${USER_AGENT}`,
          ]);

          // An empty response is a gap in the translation, not the end of the
          // surah — keep paging.
          if (html.trim().length === 0 || html.includes("No verses found")) {
            start += 10;
            await sleep(TRANSLATION_DELAY_MS);
            continue;
          }

          const $ = cheerio.load(html);
          const prevCum = QURAN_CUMULATIVE[surah - 1];

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
          });

          // A page with no parseable verses is another gap; keep paging.
          start += 10;
          await sleep(TRANSLATION_DELAY_MS);
        } catch (error) {
          console.error(`\nError fetching sura ${surah} start ${start}:`, error);
          keepGoing = false;
        }
      }

      const captured = Object.keys(translationResult).filter((k) =>
        k.startsWith(`${surah}:`),
      ).length;
      console.log(` ${captured}/${SURAH_VERSE_COUNTS[surah]} verses.`);
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
          `user-agent: ${USER_AGENT}`,
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
    const translationPath = join(publicDataDir, "abu-iyaad.json");

    // Refuse to shrink the dataset. A run that captures fewer verses than the
    // file already holds is a scrape failure (a pagination bug, a blocked
    // session, a site change), not the translation losing content — and
    // overwriting anyway is what silently dropped 1294 verses in f8f34259.
    // SCRAPE_ALLOW_SHRINK=1 overrides when the loss is genuinely intended.
    let existingCount = 0;
    try {
      existingCount = Object.keys(
        JSON.parse(await readFile(translationPath, "utf8")),
      ).length;
    } catch {
      // No existing file (or unreadable) — nothing to protect.
    }

    if (verseKeys.length < existingCount && !process.env.SCRAPE_ALLOW_SHRINK) {
      throw new Error(
        `Refusing to overwrite ${translationPath}: scraped ${verseKeys.length} verses ` +
          `but the existing file has ${existingCount}. Investigate the scrape, or set ` +
          `SCRAPE_ALLOW_SHRINK=1 to write anyway.`,
      );
    }

    await writeFile(translationPath, JSON.stringify(translationResult));
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
