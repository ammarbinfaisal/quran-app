import fs from "node:fs";
import path from "node:path";
import { TOTAL_CHAPTERS, TOTAL_PAGES } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";

type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

interface SitemapChunk {
  id: string;
  paths: string[];
  changefreq: ChangeFrequency;
  priority: number;
}

const JUZ_COUNT = 30;
const LEMMA_CHUNK_SIZE = 2500;
const ROOT_CHUNK_SIZE = 2500;

let cachedChunks: SitemapChunk[] | null = null;

function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}

function splitIntoChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function listJsonBasenames(dir: string, ignored = new Set<string>()): string[] {
  const files = fs.readdirSync(dir);
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .filter((name) => !ignored.has(name))
    .sort((a, b) => a.localeCompare(b));
}

function getLemmaPaths(): string[] {
  const lemmasDir = path.join(process.cwd(), "public", "data", "lemmas");
  const keys = listJsonBasenames(lemmasDir, new Set(["index"]));
  return keys.map((key) => `/m/${encodeURIComponent(key)}`);
}

function getRootPaths(): string[] {
  const rootsDir = path.join(process.cwd(), "public", "data", "roots");
  const keys = listJsonBasenames(rootsDir);
  return keys.map((key) => `/r/${encodeURIComponent(key)}`);
}

export function getSitemapChunks(): SitemapChunk[] {
  if (cachedChunks) return cachedChunks;

  const corePaths = ["/", "/search"];
  const mushafPaths = range(1, TOTAL_PAGES).map((page) => `/p/${page}`);

  const versePaths = [
    ...range(1, TOTAL_PAGES).map((page) => `/v/p/${page}`),
    ...range(1, TOTAL_CHAPTERS).map((surah) => `/v/s/${surah}`),
    ...range(1, JUZ_COUNT).map((juz) => `/v/j/${juz}`),
  ];

  const scrollPaths = [
    ...range(1, TOTAL_PAGES).map((page) => `/s/p/${page}`),
    ...range(1, TOTAL_CHAPTERS).map((surah) => `/s/s/${surah}`),
    ...range(1, JUZ_COUNT).map((juz) => `/s/j/${juz}`),
  ];

  const lemmaChunks = splitIntoChunks(getLemmaPaths(), LEMMA_CHUNK_SIZE);
  const rootChunks = splitIntoChunks(getRootPaths(), ROOT_CHUNK_SIZE);

  const chunks: SitemapChunk[] = [
    { id: "core", paths: corePaths, changefreq: "weekly", priority: 1.0 },
    { id: "mushaf-pages", paths: mushafPaths, changefreq: "daily", priority: 0.95 },
    { id: "verse-mode", paths: versePaths, changefreq: "weekly", priority: 0.9 },
    { id: "scroll-mode", paths: scrollPaths, changefreq: "weekly", priority: 0.85 },
  ];

  lemmaChunks.forEach((paths, index) => {
    chunks.push({
      id: `lemmas-${index + 1}`,
      paths,
      changefreq: "monthly",
      priority: 0.75,
    });
  });

  rootChunks.forEach((paths, index) => {
    chunks.push({
      id: `roots-${index + 1}`,
      paths,
      changefreq: "monthly",
      priority: 0.75,
    });
  });

  cachedChunks = chunks;
  return chunks;
}

export function getSitemapChunkById(id: string): SitemapChunk | undefined {
  return getSitemapChunks().find((chunk) => chunk.id === id);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapIndexXml(lastmod: string): string {
  const rows = getSitemapChunks()
    .map((chunk) => {
      const loc = escapeXml(absoluteUrl(`/sitemaps/${chunk.id}.xml`));
      return `<sitemap><loc>${loc}</loc><lastmod>${lastmod}</lastmod></sitemap>`;
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows,
    "</sitemapindex>",
  ].join("");
}

export function buildSitemapXml(chunk: SitemapChunk, lastmod: string): string {
  const rows = chunk.paths
    .map((routePath) => {
      const loc = escapeXml(absoluteUrl(routePath));
      return [
        "<url>",
        `<loc>${loc}</loc>`,
        `<lastmod>${lastmod}</lastmod>`,
        `<changefreq>${chunk.changefreq}</changefreq>`,
        `<priority>${chunk.priority.toFixed(2)}</priority>`,
        "</url>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows,
    "</urlset>",
  ].join("");
}
