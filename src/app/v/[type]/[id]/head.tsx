import { getChapters } from "@/lib/chapters";
import { TOTAL_PAGES } from "@/lib/constants";
import { JUZ_PAGE_RANGES } from "@/lib/juz";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function clampPage(n: number) {
  return Math.max(1, Math.min(TOTAL_PAGES, n));
}

function getStartPage(type: string, id: number) {
  if (type === "p") return clampPage(id);
  if (type === "s") {
    const chapters = getChapters();
    const ch = chapters.find((c) => c.id === id);
    return clampPage(ch?.pages?.[0] ?? 1);
  }
  if (type === "j") {
    const j = JUZ_PAGE_RANGES.find((jz) => jz.juz === id);
    return clampPage(j?.pages?.[0] ?? 1);
  }
  return 1;
}

export default async function Head({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const isProd = process.env.NODE_ENV === "production";
  const { type, id } = await params;
  const n = parseInt(id, 10);
  const safeId = Number.isFinite(n) ? n : 1;
  const startPage = getStartPage(type, safeId);

  // VerseByVerseViewer mounts with up to 5 pages, but above-the-fold is the
  // start page. Preload the first 2 pages to reduce first-open skeletons.
  const pages = [startPage, startPage + 1]
    .map(clampPage)
    .filter((p, idx, arr) => arr.indexOf(p) === idx);

  return (
    <>
      {pages.map((p) => (
        <link
          key={`font-${p}`}
          rel="preload"
          as="font"
          type="font/woff2"
          href={`/mushaf-fonts/v2/p${pad3(p)}.woff2?rev=${MUSHAF_ASSET_REV}`}
          crossOrigin="anonymous"
        />
      ))}

      {pages.map((p) => (
        <link
          key={`page-${p}`}
          rel="preload"
          as="fetch"
          href={`/mushaf-data/v2/p${pad3(p)}.json?rev=${MUSHAF_ASSET_REV}`}
          crossOrigin="anonymous"
        />
      ))}

      {isProd && pages.map((p) => (
        <link
          key={`tr-saheeh-${p}`}
          rel="preload"
          as="fetch"
          href={`/data/translations/saheeh/p${pad3(p)}.json`}
          crossOrigin="anonymous"
        />
      ))}

      <link
        rel="preload"
        as="fetch"
        href="/data/abu-iyaad.json"
        crossOrigin="anonymous"
      />
    </>
  );
}
