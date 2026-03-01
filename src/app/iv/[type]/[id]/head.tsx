import { INDOPAK_TOTAL_PAGES } from "@/lib/constants";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";
import { getChapters } from "@/lib/chapters";
import { JUZ_PAGE_RANGES } from "@/lib/juz";

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function clampPage(n: number) {
  return Math.max(1, Math.min(INDOPAK_TOTAL_PAGES, n));
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
  const { type, id } = await params;
  const n = parseInt(id, 10);
  const safeId = Number.isFinite(n) ? n : 1;
  const startPage = getStartPage(type, safeId);

  const pages = [startPage, startPage + 1]
    .map(clampPage)
    .filter((p, idx, arr) => arr.indexOf(p) === idx);

  return (
    <>
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href={`/mushaf-fonts/indopak/font.woff2?rev=${MUSHAF_ASSET_REV}`}
        crossOrigin="anonymous"
      />

      {pages.map((p) => (
        <link
          key={`page-${p}`}
          rel="preload"
          as="fetch"
          href={`/mushaf-data/indopak/p${pad3(p)}.json?rev=${MUSHAF_ASSET_REV}`}
          crossOrigin="anonymous"
        />
      ))}
    </>
  );
}
