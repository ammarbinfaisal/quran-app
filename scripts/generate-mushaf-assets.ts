import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeMushafPagePayload,
  type MushafPagePayload,
} from "../src/lib/mushaf/proto";
import type { MushafCode } from "../src/lib/preferences";

const MUSHAF_CODES: readonly MushafCode[] = [
  "v1",
  "v2",
  "t4",
  "ut",
  "i5",
  "i6",
  "qh",
  "tj",
];

async function writeText(path: string, content: string) {
  await Bun.write(path, content);
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

function getArgFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function samplePayload(code: MushafCode): MushafPagePayload {
  return {
    page: 1,
    mushafCode: code,
    lines: [
      {
        lineNumber: 1,
        words: [
          {
            text: "\u0627\u0644\u062d\u0645\u062f",
            verseKey: "1:2",
            x: 12,
            width: 36,
          },
        ],
      },
    ],
  };
}

async function writeSampleAssets(root: string) {
  for (const code of MUSHAF_CODES) {
    const dataDir = resolve(root, "public", "mushaf-data", code);
    const fontDir = resolve(root, "public", "mushaf-fonts", code);

    await ensureDir(dataDir);
    await ensureDir(fontDir);

    const payload = samplePayload(code);

    await writeText(resolve(dataDir, "p001.json"), JSON.stringify(payload, null, 2));
    await Bun.write(resolve(dataDir, "p001.pb"), encodeMushafPagePayload(payload));
  }
}

function manifestTemplate() {
  return `import { TOTAL_PAGES } from "@/lib/constants";
import type { MushafCode } from "@/lib/preferences";

// Generated contract for local mushaf page/font assets.
// scripts/generate-mushaf-assets.ts can rewrite this file.

export type MushafManifestEntry = {
  pageDataPath: string;
  pageProtoPath: string;
  fontPath?: string;
};

export type MushafManifest = Record<number, MushafManifestEntry>;

const mushafCodes: readonly MushafCode[] = [
  "v1",
  "v2",
  "t4",
  "ut",
  "i5",
  "i6",
  "qh",
  "tj",
];

function createManifestForCode(code: MushafCode): MushafManifest {
  const entries: MushafManifest = {};

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const pageId = String(page).padStart(3, "0");
    entries[page] = {
      pageDataPath: \`/mushaf-data/\${code}/p\${pageId}.json\`,
      pageProtoPath: \`/mushaf-data/\${code}/p\${pageId}.pb\`,
      fontPath: \`/mushaf-fonts/\${code}/p\${pageId}.woff2\`,
    };
  }

  return entries;
}

export const MUSHAF_MANIFESTS: Record<MushafCode, MushafManifest> = {
  v1: createManifestForCode(mushafCodes[0]),
  v2: createManifestForCode(mushafCodes[1]),
  t4: createManifestForCode(mushafCodes[2]),
  ut: createManifestForCode(mushafCodes[3]),
  i5: createManifestForCode(mushafCodes[4]),
  i6: createManifestForCode(mushafCodes[5]),
  qh: createManifestForCode(mushafCodes[6]),
  tj: createManifestForCode(mushafCodes[7]),
};
`;
}

function getProjectRoot() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "..");
}

async function main() {
  const root = getProjectRoot();
  const generatedManifestPath = resolve(root, "src", "generated", "mushaf-manifest.ts");

  await ensureDir(resolve(root, "src", "generated"));
  await ensureDir(resolve(root, "public", "mushaf-data"));
  await ensureDir(resolve(root, "public", "mushaf-fonts"));

  await writeText(generatedManifestPath, manifestTemplate());

  if (getArgFlag("--seed-sample")) {
    await writeSampleAssets(root);
    console.log("Seeded sample mushaf assets for page 001.");
  }

  console.log("Generated src/generated/mushaf-manifest.ts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
