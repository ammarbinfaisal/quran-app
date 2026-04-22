import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import { MUSHAF_TOTAL_PAGES } from "../src/lib/constants";
import {
  encodeMushafPagePayload,
  type MushafPagePayload,
} from "../src/lib/mushaf/proto";
import type { MushafLineType } from "../src/lib/types";

type SupportedCode = "v2" | "i15";

/** Per-code defaults: where the generator reads layout / words / fonts from. */
const CODE_DEFAULTS: Record<SupportedCode, {
  layoutZip: string;
  wordsSource: { kind: "sqlite"; zip: string } | { kind: "json"; zip: string };
  fontsZip: string;
  fontOut: { kind: "per-page" } | { kind: "single"; filename: string };
}> = {
  v2: {
    layoutZip: "qpc-v2-15-lines.db.zip",
    wordsSource: { kind: "sqlite", zip: "qpc-v2.db.zip" },
    fontsZip: "QPC V2 Font.woff2.bz2",
    fontOut: { kind: "per-page" },
  },
  i15: {
    layoutZip: "raw_data/qudratullah-indopak-15-lines.db.zip",
    wordsSource: { kind: "json", zip: "raw_data/indopak-nastaleeq.json.zip" },
    fontsZip: "raw_data/font.woff2.zip",
    fontOut: { kind: "single", filename: "indopak-nastaleeq.woff2" },
  },
};

const DEFAULT_CODE: SupportedCode = "v2";

type LayoutInfoRow = {
  name: string;
  number_of_pages: number;
  lines_per_page: number;
  font_name: string;
};

type LayoutPageRow = {
  page_number: number;
  line_number: number;
  line_type: string;
  is_centered: number | null;
  first_word_id: number | null;
  last_word_id: number | null;
  surah_number: number | null;
};

type WordRow = {
  id: number;
  location: string;
  surah: number;
  ayah: number;
  word: number;
  text: string;
};

type GenerationStats = {
  generated: number;
  skipped: number;
  errors: number;
  lineWarnings: number;
};

type DbHandle = {
  dbPath: string;
  cleanup: () => Promise<void>;
};

function usageAndExit(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.error(
    [
      "Usage:",
      "  bun scripts/generate-mushaf-assets.ts --all",
      "  bun scripts/generate-mushaf-assets.ts --pages 1-3",
      "  bun scripts/generate-mushaf-assets.ts --pages 1,2,604",
      "  bun scripts/generate-mushaf-assets.ts --seed-sample",
      "",
      "Options:",
      "  --all                 Generate all pages (default if no page option is provided)",
      "  --pages <spec>        Page range (e.g. 1-20) or comma list (e.g. 1,2,50)",
      "  --seed-sample         Generate only pages 1-3",
      "  --force               Overwrite existing output files",
      "  --code <code>         Only 'v2' is supported",
      "  --layout-zip <path>   Layout ZIP source (default: qpc-v2-15-lines.db.zip)",
      "  --layout-db <path>    Layout SQLite source (bypasses ZIP extraction)",
      "  --words-zip <path>    Words DB ZIP source (default: qpc-v2.db.zip)",
      "  --words-db <path>     Words SQLite source (bypasses ZIP extraction)",
      "  --out-dir <path>      Output directory for generated page assets",
      "  --extract-fonts       Extract per-page woff2 fonts from archive",
      "  --fonts-zip <path>    Font archive path (default: QPC V2 Font.woff2.bz2)",
      "",
      "Source model:",
      "  - Page structure is taken from the layout SQLite (pages table).",
      "  - Word data is read from the words SQLite (words table).",
      "  - Only rows with line_type='ayah' are emitted into page payload lines.",
    ].join("\n"),
  );
  process.exit(1);
}

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function ensureSupportedCodeOrExit(): SupportedCode {
  const codeArg = getArg("--code");
  const raw = (codeArg ?? DEFAULT_CODE).trim();
  if (raw !== "v2" && raw !== "i15") {
    usageAndExit(`Unsupported code: ${raw}. Supported: v2, i15.`);
  }
  return raw;
}

function parsePageSpec(spec: string, maxPages: number): number[] {
  const trimmed = spec.trim();
  if (!trimmed) usageAndExit("--pages cannot be empty.");

  const out = new Set<number>();
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start
      ) {
        usageAndExit(`Invalid page range: ${part}`);
      }
      for (let pageNum = start; pageNum <= end; pageNum++) {
        if (pageNum <= maxPages) out.add(pageNum);
      }
      continue;
    }

    const pageNum = Number(part);
    if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > maxPages) {
      usageAndExit(`Invalid page number: ${part}`);
    }
    out.add(pageNum);
  }

  return Array.from(out).sort((a, b) => a - b);
}

function resolveTargetPages(maxPages: number): number[] {
  const pagesArg = getArg("--pages");
  const seedSample = hasFlag("--seed-sample");

  if (pagesArg) {
    return parsePageSpec(pagesArg, maxPages);
  }

  if (seedSample) {
    return [1, 2, 3];
  }

  const pages: number[] = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) pages.push(pageNum);
  return pages;
}

async function extractDbFromZip(
  zipPath: string,
  label: string,
): Promise<DbHandle> {
  if (!existsSync(zipPath)) {
    throw new Error(`${label} ZIP not found: ${zipPath}`);
  }

  const entriesRaw = execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
  });
  const entries = entriesRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dbEntry = entries.find((entry) => entry.toLowerCase().endsWith(".db"));
  if (!dbEntry) {
    throw new Error(`No .db file found in ZIP: ${zipPath}`);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), `qpc-${label}-`));
  execFileSync("unzip", ["-o", zipPath, dbEntry, "-d", tempDir], {
    encoding: "utf8",
  });
  const outPath = path.join(tempDir, path.basename(dbEntry));

  return {
    dbPath: outPath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function resolveLayoutDb(code: SupportedCode): Promise<DbHandle> {
  const layoutDbArg = getArg("--layout-db");
  const layoutZipArg = getArg("--layout-zip");

  if (layoutDbArg) {
    const dbPath = path.resolve(layoutDbArg);
    if (!existsSync(dbPath)) throw new Error(`Layout DB not found: ${dbPath}`);
    return { dbPath, cleanup: async () => {} };
  }

  const zipPath = path.resolve(layoutZipArg ?? CODE_DEFAULTS[code].layoutZip);
  return extractDbFromZip(zipPath, "layout");
}

async function resolveWordsDb(code: SupportedCode): Promise<DbHandle> {
  const wordsDbArg = getArg("--words-db");
  const wordsZipArg = getArg("--words-zip");

  if (wordsDbArg) {
    const dbPath = path.resolve(wordsDbArg);
    if (!existsSync(dbPath)) throw new Error(`Words DB not found: ${dbPath}`);
    return { dbPath, cleanup: async () => {} };
  }

  const defaults = CODE_DEFAULTS[code];
  if (defaults.wordsSource.kind !== "sqlite") {
    throw new Error(
      `resolveWordsDb called for code ${code} which uses a JSON word source`,
    );
  }
  const zipPath = path.resolve(wordsZipArg ?? defaults.wordsSource.zip);
  return extractDbFromZip(zipPath, "words");
}

type JsonWordRow = {
  id: number;
  location: string;
  surah: number;
  ayah: number;
  word: number;
  text: string;
};

type WordsJsonHandle = {
  wordMap: Map<number, JsonWordRow>;
  verseEndIds: Set<number>;
  cleanup: () => Promise<void>;
};

/** Extract and load an Indopak-style JSON word dictionary. The JSON is a flat
    object keyed by verseKey:word position (e.g. "1:1:1") with values
    `{ id, location, surah, ayah, word, text }`. We build the same
    (wordMap, verseEndIds) shape that loadWords produces for the sqlite path. */
async function loadWordsFromJsonZip(zipPath: string): Promise<WordsJsonHandle> {
  if (!existsSync(zipPath)) {
    throw new Error(`Words JSON ZIP not found: ${zipPath}`);
  }
  const tempDir = await mkdtemp(path.join(tmpdir(), `qpc-words-json-`));
  try {
    execFileSync("unzip", ["-o", zipPath, "-d", tempDir], { encoding: "utf8" });
    const entriesRaw = execFileSync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
    });
    const jsonEntry = entriesRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .find((e) => e.toLowerCase().endsWith(".json"));
    if (!jsonEntry) throw new Error(`No .json in ${zipPath}`);
    const filePath = path.join(tempDir, path.basename(jsonEntry));
    const raw = readFileSync(filePath, "utf8");
    const obj = JSON.parse(raw) as Record<
      string,
      {
        id: number;
        location: string;
        surah: number | string;
        ayah: number | string;
        word: number | string;
        text: string;
      }
    >;

    const wordMap = new Map<number, JsonWordRow>();
    const maxWordIdPerVerse = new Map<string, number>();
    for (const entry of Object.values(obj)) {
      const row: JsonWordRow = {
        id: Number(entry.id),
        location: entry.location,
        surah: Number(entry.surah),
        ayah: Number(entry.ayah),
        word: Number(entry.word),
        text: entry.text,
      };
      wordMap.set(row.id, row);
      const verseKey = `${row.surah}:${row.ayah}`;
      const existing = maxWordIdPerVerse.get(verseKey);
      if (existing === undefined || row.id > existing) {
        maxWordIdPerVerse.set(verseKey, row.id);
      }
    }
    const verseEndIds = new Set(maxWordIdPerVerse.values());
    console.log(
      `Loaded ${wordMap.size} words from JSON, ${verseEndIds.size} verse-end markers`,
    );
    return {
      wordMap,
      verseEndIds,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (e) {
    await rm(tempDir, { recursive: true, force: true });
    throw e;
  }
}

function queryLayout(dbPath: string): {
  info: LayoutInfoRow;
  rows: LayoutPageRow[];
} {
  const db = new Database(dbPath, { readonly: true });
  try {
    const infoStmt = db.query(
      "SELECT name, number_of_pages, lines_per_page, font_name FROM info LIMIT 1",
    );
    const info = infoStmt.get() as LayoutInfoRow | null;
    if (!info) {
      throw new Error("Missing info row in layout DB.");
    }

    const rowsStmt = db.query(
      [
        "SELECT",
        "  page_number,",
        "  line_number,",
        "  line_type,",
        "  is_centered,",
        "  first_word_id,",
        "  last_word_id,",
        "  surah_number",
        "FROM pages",
        "ORDER BY page_number, line_number",
      ].join("\n"),
    );
    const rows = rowsStmt.all() as LayoutPageRow[];
    if (!rows.length) {
      throw new Error("No rows found in pages table.");
    }

    return { info, rows };
  } finally {
    db.close();
  }
}

function loadWords(dbPath: string): {
  wordMap: Map<number, WordRow>;
  verseEndIds: Set<number>;
} {
  const db = new Database(dbPath, { readonly: true });
  try {
    const stmt = db.query(
      "SELECT id, location, surah, ayah, word, text FROM words ORDER BY id",
    );
    const rows = stmt.all() as WordRow[];

    const wordMap = new Map<number, WordRow>();
    // Track max word ID per surah:ayah to identify verse-end markers
    const maxWordIdPerVerse = new Map<string, number>();

    for (const row of rows) {
      wordMap.set(row.id, row);
      const verseKey = `${row.surah}:${row.ayah}`;
      const existing = maxWordIdPerVerse.get(verseKey);
      if (existing === undefined || row.id > existing) {
        maxWordIdPerVerse.set(verseKey, row.id);
      }
    }

    const verseEndIds = new Set<number>(maxWordIdPerVerse.values());

    console.log(
      `Loaded ${wordMap.size} words, ${verseEndIds.size} verse-end markers`,
    );

    return { wordMap, verseEndIds };
  } finally {
    db.close();
  }
}

function generatePagePayload(options: {
  code: SupportedCode;
  page: number;
  layoutRows: LayoutPageRow[];
  wordMap: Map<number, WordRow | JsonWordRow>;
  verseEndIds: Set<number>;
  lineWarnings: Array<{ page: number; line: number; message: string }>;
  stats: GenerationStats;
}): MushafPagePayload {
  const { code, page, layoutRows, wordMap, verseEndIds, lineWarnings, stats } =
    options;

  const outLines: MushafPagePayload["lines"] = [];

  for (const row of layoutRows) {
    const lineType: MushafLineType =
      row.line_type === "surah_name"
        ? "surah_name"
        : row.line_type === "basmallah"
          ? "basmallah"
          : "ayah";

    // For i15 (and any future layout) surah_name / basmallah rows carry the
    // surah number in LayoutPageRow.surah_number and have no words. Emit them
    // with empty words arrays so the renderer can slot headers/basmallah
    // directly from the layout data instead of deriving them from chapters.
    if (lineType !== "ayah") {
      const line: MushafPagePayload["lines"][number] = {
        lineNumber: row.line_number,
        lineType,
        words: [],
      };
      if (row.is_centered === 1) line.centered = true;
      // surah_number column in the layout DB is typed loosely — NULL arrives
      // as `null`, but empty rows can come through as `""`. Only accept real
      // integers to satisfy the proto int32 field.
      if (typeof row.surah_number === "number" && Number.isFinite(row.surah_number)) {
        line.surahNumber = row.surah_number;
      }
      outLines.push(line);
      continue;
    }

    if (row.first_word_id == null || row.last_word_id == null) {
      lineWarnings.push({
        page,
        line: row.line_number,
        message: "Ayah line has null word ID range; skipped.",
      });
      stats.lineWarnings++;
      continue;
    }

    const words: MushafPagePayload["lines"][number]["words"] = [];
    let idx = 0;

    for (let wid = row.first_word_id; wid <= row.last_word_id; wid++) {
      const wordRow = wordMap.get(wid);
      if (!wordRow) {
        lineWarnings.push({
          page,
          line: row.line_number,
          message: `Word ID ${wid} not found in words source.`,
        });
        stats.lineWarnings++;
        continue;
      }

      words.push({
        text: wordRow.text,
        verseKey: `${wordRow.surah}:${wordRow.ayah}`,
        x: idx * 20,
        width: 20,
        charTypeName: verseEndIds.has(wid) ? "end" : "word",
      });
      idx++;
    }

    const ayahLine: MushafPagePayload["lines"][number] = {
      lineNumber: row.line_number,
      lineType: "ayah",
      words,
    };
    if (row.is_centered === 1) ayahLine.centered = true;
    outLines.push(ayahLine);
  }

  return {
    page,
    mushafCode: code,
    lines: outLines,
  };
}

async function extractFonts(
  code: SupportedCode,
  fontsZipPath: string,
  outDir: string,
) {
  if (!existsSync(fontsZipPath)) {
    throw new Error(`Font archive not found: ${fontsZipPath}`);
  }

  await mkdir(outDir, { recursive: true });

  const tempDir = await mkdtemp(path.join(tmpdir(), `qpc-fonts-${code}-`));
  const fontOut = CODE_DEFAULTS[code].fontOut;

  try {
    execFileSync("unzip", ["-o", fontsZipPath, "-d", tempDir], {
      encoding: "utf8",
    });

    if (fontOut.kind === "per-page") {
      let copied = 0;
      const maxPages = MUSHAF_TOTAL_PAGES[code];
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const srcName = `p${pageNum}.woff2`;
        const srcPath = path.join(tempDir, srcName);
        const dstPath = path.join(outDir, `p${pad3(pageNum)}.woff2`);
        if (!existsSync(srcPath)) {
          console.warn(`Font file not found: ${srcName}`);
          continue;
        }
        const data = await Bun.file(srcPath).arrayBuffer();
        await Bun.write(dstPath, data);
        copied++;
      }
      console.log(`Extracted ${copied} per-page font files to ${outDir}`);
    } else {
      // Single shared font: find the lone woff2 in the archive and copy it.
      const entriesRaw = execFileSync("unzip", ["-Z1", fontsZipPath], {
        encoding: "utf8",
      });
      const entry = entriesRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .find((e) => e.toLowerCase().endsWith(".woff2"));
      if (!entry) throw new Error(`No .woff2 in ${fontsZipPath}`);
      const srcPath = path.join(tempDir, path.basename(entry));
      const dstPath = path.join(outDir, fontOut.filename);
      const data = await Bun.file(srcPath).arrayBuffer();
      await Bun.write(dstPath, data);
      console.log(`Copied shared font to ${dstPath}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usageAndExit();
  }

  const code = ensureSupportedCodeOrExit();
  const force = hasFlag("--force");
  const defaults = CODE_DEFAULTS[code];
  const maxPages = MUSHAF_TOTAL_PAGES[code];

  // Handle font extraction
  if (hasFlag("--extract-fonts")) {
    const fontsZipPath = path.resolve(
      getArg("--fonts-zip") ?? defaults.fontsZip,
    );
    const fontsOutDir = path.resolve(
      getArg("--out-dir") ??
        path.join(process.cwd(), "public", "mushaf-fonts", code),
    );
    await extractFonts(code, fontsZipPath, fontsOutDir);
    if (!hasFlag("--all") && !getArg("--pages") && !hasFlag("--seed-sample")) {
      // Only font extraction was requested
      return;
    }
  }

  const pages = resolveTargetPages(maxPages);
  const outDir = path.resolve(
    getArg("--out-dir") ??
      path.join(process.cwd(), "public", "mushaf-data", code),
  );

  await mkdir(outDir, { recursive: true });

  const layoutHandle = await resolveLayoutDb(code);

  // Words source depends on code: v2 reads a SQLite table, i15 reads a JSON
  // dictionary keyed by verseKey:word position.
  let wordMap: Map<number, WordRow | JsonWordRow>;
  let verseEndIds: Set<number>;
  let wordsCleanup: () => Promise<void>;
  if (defaults.wordsSource.kind === "sqlite") {
    const wordsHandle = await resolveWordsDb(code);
    const loaded = loadWords(wordsHandle.dbPath);
    wordMap = loaded.wordMap;
    verseEndIds = loaded.verseEndIds;
    wordsCleanup = wordsHandle.cleanup;
  } else {
    const wordsZipArg = getArg("--words-zip");
    const zipPath = path.resolve(wordsZipArg ?? defaults.wordsSource.zip);
    const loaded = await loadWordsFromJsonZip(zipPath);
    wordMap = loaded.wordMap;
    verseEndIds = loaded.verseEndIds;
    wordsCleanup = loaded.cleanup;
  }

  const stats: GenerationStats = {
    generated: 0,
    skipped: 0,
    errors: 0,
    lineWarnings: 0,
  };
  const lineWarnings: Array<{ page: number; line: number; message: string }> =
    [];

  try {
    const { info, rows } = queryLayout(layoutHandle.dbPath);

    if (info.number_of_pages !== maxPages) {
      console.warn(
        `Layout reports ${info.number_of_pages} pages, while app expects ${maxPages} for code ${code}. Continuing with app page limits.`,
      );
    }

    const rowsByPage = new Map<number, LayoutPageRow[]>();
    for (const row of rows) {
      const bucket = rowsByPage.get(row.page_number) ?? [];
      bucket.push(row);
      rowsByPage.set(row.page_number, bucket);
    }

    console.log(
      [
        `Generating mushaf assets...`,
        `code=${code}`,
        `pages=${pages.length}`,
        `force=${force}`,
        `layout=${layoutHandle.dbPath}`,
        `wordsSource=${defaults.wordsSource.kind}`,
        `outDir=${outDir}`,
        `layoutName=${info.name}`,
        `layoutFont=${info.font_name}`,
      ].join(" "),
    );

    let completed = 0;
    for (const page of pages) {
      const pageRows = rowsByPage.get(page) ?? [];
      if (!pageRows.length) {
        stats.errors++;
        console.error(`No layout rows found for page ${page}.`);
        continue;
      }

      const outJson = path.join(outDir, `p${pad3(page)}.json`);
      const outPb = path.join(outDir, `p${pad3(page)}.pb`);
      if (!force && existsSync(outJson) && existsSync(outPb)) {
        stats.skipped++;
        completed++;
        if (completed % 25 === 0 || completed === pages.length) {
          const pct = ((completed / pages.length) * 100).toFixed(1);
          process.stdout.write(`\rProgress: ${completed}/${pages.length} (${pct}%)`);
        }
        continue;
      }

      try {
        const payload = generatePagePayload({
          code,
          page,
          layoutRows: pageRows,
          wordMap,
          verseEndIds,
          lineWarnings,
          stats,
        });

        await Bun.write(outJson, JSON.stringify(payload));
        await Bun.write(outPb, encodeMushafPagePayload(payload));
        stats.generated++;
      } catch (error) {
        stats.errors++;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed page ${page}: ${message}`);
      }

      completed++;
      if (completed % 25 === 0 || completed === pages.length) {
        const pct = ((completed / pages.length) * 100).toFixed(1);
        process.stdout.write(
          `\rProgress: ${completed}/${pages.length} (${pct}%)`,
        );
      }
    }

    process.stdout.write("\n");

    console.log("--- Generation Summary ---");
    console.table({
      [code]: {
        generated: stats.generated,
        skipped: stats.skipped,
        errors: stats.errors,
        lineWarnings: stats.lineWarnings,
      },
    });

    if (lineWarnings.length > 0) {
      console.warn(`\nLine warnings (${lineWarnings.length}) - showing first 30:`);
      for (const warning of lineWarnings.slice(0, 30)) {
        console.warn(
          `- p${warning.page} line ${warning.line}: ${warning.message}`,
        );
      }
      if (lineWarnings.length > 30) {
        console.warn(`- ... and ${lineWarnings.length - 30} more`);
      }
    }

    if (stats.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await layoutHandle.cleanup();
    await wordsCleanup();
  }
}

await main();
