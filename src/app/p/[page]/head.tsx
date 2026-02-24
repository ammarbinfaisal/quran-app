import { TOTAL_PAGES } from "@/lib/constants";
import { MUSHAF_ASSET_REV } from "@/lib/mushaf/assetRev";

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function clampPage(n: number) {
  return Math.max(1, Math.min(TOTAL_PAGES, n));
}

export default async function Head({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: pageParam } = await params;
  const n = parseInt(pageParam, 10);
  const page = Number.isFinite(n) ? clampPage(n) : 1;

  // SwipeReader renders [page-1, page, page+1] immediately.
  const pages = [page - 1, page, page + 1]
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
    </>
  );
}
