/**
 * Restores Abu Iyaad translation verses that were dropped from
 * public/data/abu-iyaad.json.
 *
 * History: the original scrape stored each verse as an HTML string with
 * <span style="color:#898989"> marking the shaykh's parenthetical
 * annotations. A later commit reworked the scraper and rewrote the file in
 * the precomputed CompactSeg[] shape the app reads today, but that re-scrape
 * only captured 985 verses — 1294 already-scraped verses were lost with the
 * format change. Their keys were correct all along, so they can be recovered
 * from git and converted forward rather than re-scraped.
 *
 * This reads the historical versions, converts any HTML-shaped verse to
 * CompactSeg[], and merges them under the current data (which always wins on
 * conflict, being the newer scrape).
 *
 * Usage:
 *   bun run scripts/restore-abu-iyaad.ts          # report only
 *   bun run scripts/restore-abu-iyaad.ts --write  # apply
 */
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

/** Matches the app's CompactSeg: a plain run, or an annotation. */
type CompactSeg = string | { a: string };

const DATA_PATH = path.join(process.cwd(), "public/data/abu-iyaad.json");

/**
 * Commits holding earlier, larger versions of the file, oldest first. Later
 * entries win over earlier ones, and the working-tree file wins over all.
 */
const SOURCE_COMMITS = ["b424b3b5", "40802128"];

const ANNOTATION_SPAN_RE =
  /<span\s+style="color:#898989;?"\s*>([\s\S]*?)<\/span>/gi;
const ANY_TAG_RE = /<[^>]+>/g;

function readFromGit(commit: string): Record<string, unknown> {
  const raw = execFileSync(
    "git",
    ["show", `${commit}:public/data/abu-iyaad.json`],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Split an HTML verse into alternating plain runs and annotations. The
 * grey-span colour is the only marker the source uses for the shaykh's
 * explanatory insertions.
 */
function htmlToSegments(html: string): CompactSeg[] {
  const segments: CompactSeg[] = [];
  let last = 0;

  const push = (value: string, annotation: boolean) => {
    const text = decodeEntities(value.replace(ANY_TAG_RE, ""));
    if (!text.trim()) return;
    if (annotation) segments.push({ a: text.trim() });
    else segments.push(text);
  };

  for (const match of html.matchAll(ANNOTATION_SPAN_RE)) {
    const index = match.index ?? 0;
    if (index > last) push(html.slice(last, index), false);
    push(match[1], true);
    last = index + match[0].length;
  }
  if (last < html.length) push(html.slice(last), false);

  return segments;
}

function toSegments(value: unknown): CompactSeg[] | null {
  if (typeof value === "string") {
    const segments = htmlToSegments(value);
    return segments.length > 0 ? segments : null;
  }
  if (Array.isArray(value)) {
    const segments = value.filter(
      (s): s is CompactSeg =>
        typeof s === "string" ||
        (typeof s === "object" && s !== null && typeof (s as { a?: unknown }).a === "string"),
    );
    return segments.length > 0 ? segments : null;
  }
  return null;
}

function plainText(segments: CompactSeg[]): string {
  return segments
    .map((s) => (typeof s === "string" ? s : s.a))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function main(): void {
  const write = process.argv.includes("--write");

  const current = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Record<
    string,
    CompactSeg[]
  >;

  const chapters: { id: number; versesCount: number }[] = JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/chapters.json"), "utf-8"),
  );
  const versesCount = new Map(chapters.map((c) => [c.id, c.versesCount]));

  const merged: Record<string, CompactSeg[]> = {};
  let recovered = 0;
  let skippedInvalid = 0;

  for (const commit of SOURCE_COMMITS) {
    const historical = readFromGit(commit);
    for (const [verseKey, value] of Object.entries(historical)) {
      if (current[verseKey]) continue; // newer scrape wins

      const [surahPart, ayahPart] = verseKey.split(":");
      const surah = Number(surahPart);
      const ayah = Number(ayahPart);
      const total = versesCount.get(surah);
      if (!total || !Number.isFinite(ayah) || ayah < 1 || ayah > total) {
        skippedInvalid++;
        continue;
      }

      const segments = toSegments(value);
      if (!segments) continue;
      if (!merged[verseKey]) recovered++;
      merged[verseKey] = segments;
    }
  }

  const output: Record<string, CompactSeg[]> = { ...merged, ...current };

  // Sort by surah then ayah so the file stays reviewable in diffs.
  const sorted: Record<string, CompactSeg[]> = {};
  for (const key of Object.keys(output).sort((a, b) => {
    const [as, aa] = a.split(":").map(Number);
    const [bs, ba] = b.split(":").map(Number);
    return as - bs || aa - ba;
  })) {
    sorted[key] = output[key];
  }

  console.log(`current verses:   ${Object.keys(current).length}`);
  console.log(`recovered:        ${recovered}`);
  console.log(`skipped invalid:  ${skippedInvalid}`);
  console.log(`total after merge: ${Object.keys(sorted).length} / 6236`);

  const sample = Object.keys(merged).slice(0, 3);
  for (const key of sample) {
    console.log(`  ${key}: ${plainText(merged[key]).slice(0, 90)}`);
  }

  if (!write) {
    console.log("\nDry run. Pass --write to apply.");
    return;
  }

  writeFileSync(DATA_PATH, `${JSON.stringify(sorted)}\n`);
  console.log(`\nWrote ${DATA_PATH}`);
}

main();
