/**
 * Fetch English tafsir data from the Quran.Foundation content API.
 *
 * Output matches the existing (Arabic) tafsir layout produced by
 * scrape-tafsir.ts: one file per surah at
 * public/data/tafsir/<id>/<surah>.json, keyed by ayah number,
 * each value { text }.
 *
 * The API repeats a range's full commentary on every ayah of that range.
 * We keep the text only on the first ayah of each run and drop the
 * duplicates, which reproduces the sparse shape the loader and the
 * availability bitmaps already expect.
 *
 * Usage:
 *   bun run scripts/fetch-tafsir-en.ts
 *   bun run scripts/fetch-tafsir-en.ts --surah=18
 *   bun run scripts/fetch-tafsir-en.ts --env=prelive
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { tafsirHtmlToMarkdown } from "./lib/tafsir-html-to-markdown";

const RESOURCE_ID = 169; // Ibn Kathir (Abridged), english
const OUTPUT_ID = "ibn-katheer-en";

const ENVS = {
  production: {
    auth: "https://oauth2.quran.foundation",
    api: "https://apis.quran.foundation/content/api/v4",
    clientId: process.env.QURAN_API_PROD_CLIENT_ID,
    clientSecret: process.env.QURAN_API_PROD_CLIENT_SECRET,
  },
  prelive: {
    auth: "https://prelive-oauth2.quran.foundation",
    api: "https://apis-prelive.quran.foundation/content/api/v4",
    clientId: process.env.QURAN_API_CLIENT_ID,
    clientSecret: process.env.QURAN_API_CLIENT_SECRET,
  },
} as const;

const args = process.argv.slice(2);
const envName = (args.find((a) => a.startsWith("--env="))?.split("=")[1] ??
  "production") as keyof typeof ENVS;
const onlySurah = args.find((a) => a.startsWith("--surah="))?.split("=")[1];

const env = ENVS[envName];
if (!env) {
  console.error(`Unknown --env=${envName}. Use production or prelive.`);
  process.exit(1);
}
if (!env.clientId || !env.clientSecret) {
  console.error(
    `Missing credentials for ${envName}. Set them in .env.local:\n` +
      (envName === "production"
        ? "  QURAN_API_PROD_CLIENT_ID / QURAN_API_PROD_CLIENT_SECRET"
        : "  QURAN_API_CLIENT_ID / QURAN_API_CLIENT_SECRET"),
  );
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), "public/data/tafsir", OUTPUT_ID);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let token = "";
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token;
  const creds = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString(
    "base64",
  );
  const res = await fetch(`${env.auth}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=content",
  });
  if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = json.access_token;
  // Refresh a minute early to avoid using a token that expires mid-flight.
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return token;
}

async function apiGet<T>(urlPath: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const t = await getToken();
    const res = await fetch(`${env.api}${urlPath}`, {
      headers: { "x-auth-token": t, "x-client-id": env.clientId! },
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) {
      token = "";
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${urlPath}`);
  }
  throw new Error(`Giving up on ${urlPath}`);
}

interface ChapterMeta {
  id: number;
  versesCount: number;
}

interface TafsirItem {
  verse_key: string;
  text: string | null;
}

interface ByChapterResponse {
  tafsirs: TafsirItem[];
  pagination: { next_page: number | null };
}

async function fetchSurah(surah: number): Promise<Map<number, string>> {
  const byAyah = new Map<number, string>();
  let page = 1;
  for (;;) {
    const data = await apiGet<ByChapterResponse>(
      `/tafsirs/${RESOURCE_ID}/by_chapter/${surah}?per_page=50&page=${page}`,
    );
    for (const item of data.tafsirs ?? []) {
      const ayah = Number(item.verse_key.split(":")[1]);
      const text = tafsirHtmlToMarkdown(item.text ?? "");
      if (Number.isFinite(ayah) && text) byAyah.set(ayah, text);
    }
    if (!data.pagination?.next_page) break;
    page = data.pagination.next_page;
  }
  return byAyah;
}

interface TafsirEntry {
  text: string;
  ayahsStart?: number;
  count?: number;
}

/**
 * The API repeats identical text across every ayah in a covered range.
 * Keep it on the first ayah of each run and record the span as
 * ayahsStart/count, which is how the loader's resolveEntry() maps a
 * mid-range ayah back to its commentary.
 */
function dedupeRanges(byAyah: Map<number, string>): Record<string, TafsirEntry> {
  const out: Record<string, TafsirEntry> = {};
  const ayat = [...byAyah.keys()].sort((a, b) => a - b);

  let index = 0;
  while (index < ayat.length) {
    const start = ayat[index];
    const text = byAyah.get(start)!;

    // Extend across the contiguous run of ayat sharing this exact text.
    let end = index;
    while (
      end + 1 < ayat.length &&
      ayat[end + 1] === ayat[end] + 1 &&
      byAyah.get(ayat[end + 1]) === text
    ) {
      end++;
    }

    const count = end - index + 1;
    out[String(start)] =
      count > 1 ? { text, ayahsStart: start, count } : { text };
    index = end + 1;
  }

  return out;
}

async function main(): Promise<void> {
  const chaptersPath = path.join(process.cwd(), "public/data/chapters.json");
  const chapters: ChapterMeta[] = JSON.parse(
    await Bun.file(chaptersPath).text(),
  );

  const targets = onlySurah
    ? chapters.filter((c) => c.id === Number(onlySurah))
    : chapters;

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  let totalAyat = 0;
  let totalStored = 0;

  for (const chapter of targets) {
    const byAyah = await fetchSurah(chapter.id);
    const data = dedupeRanges(byAyah);
    writeFileSync(
      path.join(OUT_DIR, `${chapter.id}.json`),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    totalAyat += byAyah.size;
    totalStored += Object.keys(data).length;
    console.log(
      `surah ${String(chapter.id).padStart(3)}: ` +
        `${String(byAyah.size).padStart(3)}/${chapter.versesCount} ayat covered, ` +
        `${Object.keys(data).length} entries written`,
    );
    await sleep(250);
  }

  console.log(
    `\nDone. ${totalAyat} ayat covered, ${totalStored} entries across ${targets.length} surahs.`,
  );
  console.log(`Output: public/data/tafsir/${OUTPUT_ID}/`);
  console.log("Next: bun run scripts/generate-tafsir-availability.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
