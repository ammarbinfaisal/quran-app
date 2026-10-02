import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import {
  QURAN_CUMULATIVE,
  SURAH_VERSE_COUNTS,
  validateAbuIyaadTranslations,
  type AbuIyaadTranslations,
  type CompactSeg,
} from "./validate-abu-iyaad-translations";

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
const SOURCE_ROOT = "https://www.thenoblequran.com/q/";
const SOURCE_PAGE_SIZE = 5;

// Slow by default to be respectful. Set SCRAPE_FAST=1 for no delays.
const FAST_MODE = !!process.env.SCRAPE_FAST;
const TRANSLATION_DELAY_MS = FAST_MODE ? 0 : 100_000;
const NOTES_DELAY_MS = FAST_MODE ? 0 : 200_000;
const NOTES_CONCURRENCY = FAST_MODE ? 6 : 1;
const ALLOW_DATASET_SHRINK = !!process.env.ALLOW_DATASET_SHRINK;

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

async function resolveCurlChromeExecutable(): Promise<string | null> {
  if (process.env.SCRAPE_NATIVE_FETCH) return null;

  const fromEnv = process.env.CURL_CHROME_BIN;
  if (fromEnv) {
    return fromEnv.startsWith("~/") ? join(homedir(), fromEnv.slice(2)) : fromEnv;
  }

  const dir = join(homedir(), "curl_chrome");
  const candidates = await readdir(dir)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  const executables = candidates
    .filter((entry) => /^curl_chrome\d+$/.test(entry))
    .sort((a, b) => Number.parseInt(b.slice("curl_chrome".length), 10) - Number.parseInt(a.slice("curl_chrome".length), 10));

  if (executables.length === 0) return null;

  return join(dir, executables[0]);
}

async function runCurlChrome(
  executable: string,
  cookieFile: string,
  url: string,
  headers: string[] = [],
): Promise<string> {
  const args = [
    "-sS",
    "--fail-with-body",
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

let nativeCookieHeader = "";

function headersFromCurlStyle(headers: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header) => {
    const separator = header.indexOf(":");
    return [header.slice(0, separator).trim(), header.slice(separator + 1).trim()];
  }));
}

async function runNativeFetch(url: string, headers: string[] = []): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...headersFromCurlStyle(headers),
      ...(nativeCookieHeader ? { cookie: nativeCookieHeader } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function runRequest(
  executable: string | null,
  cookieFile: string,
  url: string,
  headers: string[] = [],
): Promise<string> {
  if (executable) return runCurlChrome(executable, cookieFile, url, headers);
  return runNativeFetch(url, headers);
}

async function initSession(executable: string | null, cookieFile: string): Promise<void> {
  if (executable) {
    await execFileAsync(
      executable,
      ["-sS", "--fail-with-body", "-L", "-c", cookieFile, SOURCE_ROOT],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    return;
  }

  const response = await fetch(SOURCE_ROOT, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Could not establish source session: ${response.status} ${response.statusText}`);
  }
  nativeCookieHeader = response.headers.getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
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

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value));
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function run() {
  const translationResult: AbuIyaadTranslations = {};
  const notesResult: Record<string, AbuIyaadNote[]> = {};

  const executable = await resolveCurlChromeExecutable();
  const tempDir = await mkdtemp(join(tmpdir(), "abu-iyaad-"));
  const cookieFile = join(tempDir, "cookies.txt");
  const publicDataDir = join(process.cwd(), "public", "data");
  const translationsPath = join(publicDataDir, "abu-iyaad.json");
  const notesPath = join(publicDataDir, "abu-iyaad-notes.json");
  const existingTranslations = await readJsonFile<AbuIyaadTranslations>(translationsPath);
  const existingNotes = await readJsonFile<Record<string, AbuIyaadNote[]>>(notesPath);

  try {
    console.log(executable ? `Using ${executable}` : "Using native fetch");
    console.log(FAST_MODE
      ? "Fast mode (no delays)"
      : `Slow mode: ${TRANSLATION_DELAY_MS / 1000}s between translation pages, ${NOTES_DELAY_MS / 1000}s between notes (concurrency ${NOTES_CONCURRENCY})`,
    );
    console.log("Establishing session...");
    await initSession(executable, cookieFile);
    console.log("Session ready. Starting translation scrape...");

    for (let surah = 1; surah <= 114; surah++) {
      process.stdout.write(`Fetching sura ${surah}...`);
      const countBeforeSurah = Object.keys(translationResult).length;

      for (let start = 1; start <= SURAH_VERSE_COUNTS[surah]; start += SOURCE_PAGE_SIZE) {
        const url = `${SOURCE_ROOT}includes/cfm/displaysura.cfm?sura=${surah}&start=${start}`;
        const html = await runRequest(executable, cookieFile, url, [
          "accept: text/html, */*; q=0.01",
          `referer: ${SOURCE_ROOT}`,
          `user-agent: ${USER_AGENT}`,
        ]).catch((error) => {
          throw new Error(`Failed to fetch sura ${surah} start ${start}`, { cause: error });
        });

        const $ = cheerio.load(html);
        const previousCumulative = QURAN_CUMULATIVE[surah - 1];

        $("[id^='rafiam']").each((_: number, element: Element) => {
          const id = $(element).attr("id");
          const match = id?.match(/^rafiam(\d+)$/);
          if (!match) return;

          const quranPosition = Number.parseInt(match[1], 10);
          const ayah = quranPosition - previousCumulative;
          const pageEnd = Math.min(start + SOURCE_PAGE_SIZE - 1, SURAH_VERSE_COUNTS[surah]);
          if (ayah < start || ayah > pageEnd) {
            throw new Error(
              `Source returned ${id} (sura ${surah}:${ayah}) for requested range ${start}-${pageEnd}`,
            );
          }

          const segments = parseVerseHtml(($(element).html() ?? "").replace(/\s+/g, " "));
          if (segments.length === 0) return;

          const verseKey = `${surah}:${ayah}`;
          if (translationResult[verseKey]) {
            throw new Error(`Source returned duplicate translation key ${verseKey}`);
          }
          translationResult[verseKey] = segments;
        });

        await sleep(TRANSLATION_DELAY_MS);
      }

      const countAfterSurah = Object.keys(translationResult).length;
      console.log(` ${countAfterSurah - countBeforeSurah} translations.`);
    }

    const minimumTranslationCount = ALLOW_DATASET_SHRINK
      ? 1
      : Object.keys(existingTranslations).length;
    const validationReport = validateAbuIyaadTranslations(
      translationResult,
      minimumTranslationCount,
    );
    console.log(
      `Validated ${validationReport.verseCount} translations with ` +
      `${validationReport.consecutiveDuplicateCount} consecutive duplicates.`,
    );

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
        const html = await runRequest(executable, cookieFile, url, [
          "accept: text/html, */*; q=0.01",
          `referer: ${SOURCE_ROOT}`,
          "x-requested-with: XMLHttpRequest",
          `user-agent: ${USER_AGENT}`,
        ]);
        const notes = parseNotesHtml(html);
        if (notes.length > 0) {
          notesResult[verseKey] = notes;
        }
      } catch (error) {
        throw new Error(`Failed to fetch notes for ${verseKey}`, { cause: error });
      }

      if ((index + 1) % 100 === 0 || index + 1 === verseKeys.length) {
        console.log(`Processed ${index + 1}/${verseKeys.length} note pages`);
      }

      await sleep(NOTES_DELAY_MS);
    });

    if (!ALLOW_DATASET_SHRINK && Object.keys(notesResult).length < Object.keys(existingNotes).length) {
      throw new Error(
        `Refusing to replace ${Object.keys(existingNotes).length} note entries with ` +
        `${Object.keys(notesResult).length}; set ALLOW_DATASET_SHRINK=1 to override`,
      );
    }

    await atomicWriteJson(translationsPath, translationResult);
    await atomicWriteJson(notesPath, notesResult);

    console.log(`Saved ${verseKeys.length} translation keys and ${Object.keys(notesResult).length} note keys.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
