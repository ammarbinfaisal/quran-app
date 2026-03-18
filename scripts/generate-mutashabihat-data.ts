import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

interface RawPhraseGroup {
  surahs: number;
  ayahs: number;
  count: number;
  source: {
    key: string;
    from: number;
    to: number;
  };
  ayah: Record<string, Array<[number, number]>>;
}

interface GeneratedPhraseGroup {
  surahs: number;
  ayahs: number;
  count: number;
  source: {
    key: string;
    from: number;
    to: number;
    text: string;
  };
  ayah: Record<string, Array<{ from: number; to: number; text: string }>>;
}

interface UthmaniPayload {
  verses: Array<{
    verse_key: string;
    text_uthmani: string;
  }>;
}

async function unzipJson<T>(archivePath: string, entryName: string): Promise<T> {
  const { stdout } = await execFileAsync("unzip", ["-p", archivePath, entryName], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

function extractPhraseText(verseText: string, from: number, to: number): string {
  const tokens = verseText.trim().split(/\s+/);
  return tokens.slice(from - 1, to).join(" ");
}

async function run() {
  const archivePath = join(process.cwd(), "Mutashabihat ul Quran.json.bz2");
  const outputDir = join(process.cwd(), "public", "data", "mutashabihat");
  const uthmaniPath = join(process.cwd(), "rust-api", "data", "quran-uthmani.json");

  const [verseMap, rawPhraseMap, uthmaniRaw] = await Promise.all([
    unzipJson<Record<string, number[]>>(archivePath, "phrase_verses.json"),
    unzipJson<Record<string, RawPhraseGroup>>(archivePath, "phrases.json"),
    readFile(uthmaniPath, "utf8"),
  ]);

  const uthmani = JSON.parse(uthmaniRaw) as UthmaniPayload;
  const verseTextMap = new Map<string, string>(
    uthmani.verses.map((verse) => [verse.verse_key, verse.text_uthmani]),
  );

  const generatedPhraseMap: Record<string, GeneratedPhraseGroup> = {};

  for (const [id, group] of Object.entries(rawPhraseMap) as Array<[string, RawPhraseGroup]>) {
    const sourceText = extractPhraseText(
      verseTextMap.get(group.source.key) ?? "",
      group.source.from,
      group.source.to,
    );

    generatedPhraseMap[id] = {
      surahs: group.surahs,
      ayahs: group.ayahs,
      count: group.count,
      source: {
        ...group.source,
        text: sourceText,
      },
      ayah: Object.fromEntries(
        (Object.entries(group.ayah) as Array<[string, Array<[number, number]>]>).map(([verseKey, ranges]) => {
          const verseText = verseTextMap.get(verseKey) ?? "";
          return [
            verseKey,
            ranges.map(([from, to]) => ({
              from,
              to,
              text: extractPhraseText(verseText, from, to),
            })),
          ];
        }),
      ),
    };
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "phrase-verses.json"), JSON.stringify(verseMap));
  await writeFile(join(outputDir, "phrases.json"), JSON.stringify(generatedPhraseMap));
  await writeFile(
    join(outputDir, "verse-texts.json"),
    JSON.stringify(Object.fromEntries(verseTextMap)),
  );

  console.log(
    `Generated mutashabihat assets for ${Object.keys(verseMap).length} verses and ${Object.keys(generatedPhraseMap).length} phrase groups.`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
