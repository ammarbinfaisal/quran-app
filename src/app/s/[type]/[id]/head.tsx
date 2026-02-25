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
    const chapter = chapters.find((c) => c.id === id);
    return clampPage(chapter?.pages?.[0] ?? 1);
  }
  if (type === "j") {
    const juz = JUZ_PAGE_RANGES.find((entry) => entry.juz === id);
    return clampPage(juz?.pages?.[0] ?? 1);
  }
  return 1;
}

export default async function Head({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const n = Number.parseInt(id, 10);
  const safeId = Number.isFinite(n) ? n : 1;
  const startPage = getStartPage(type, safeId);

  const pages = [startPage, startPage + 1]
    .map(clampPage)
    .filter((page, index, all) => all.indexOf(page) === index);

  return (
    <>
      {pages.map((page) => (
        <link
          key={`font-${page}`}
          rel="preload"
          as="font"
          type="font/woff2"
          href={`/mushaf-fonts/v2/p${pad3(page)}.woff2?rev=${MUSHAF_ASSET_REV}`}
          crossOrigin="anonymous"
        />
      ))}

      {pages.map((page) => (
        <link
          key={`page-${page}`}
          rel="preload"
          as="fetch"
          href={`/mushaf-data/v2/p${pad3(page)}.json?rev=${MUSHAF_ASSET_REV}`}
          crossOrigin="anonymous"
        />
      ))}
    </>
  );
}
