import { notFound } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { MUSHAF_CODES, type MushafCode } from "@/lib/types";
import { Reader } from "@/components/reader/Reader";

function parsePage(page: string): number | null {
  const n = parseInt(page, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > TOTAL_PAGES) return null;
  return n;
}

function parseMushaf(mushaf: string): MushafCode | null {
  return (MUSHAF_CODES as readonly string[]).includes(mushaf)
    ? (mushaf as MushafCode)
    : null;
}

export default function MushafPageRoute({
  params,
  searchParams,
}: {
  params: { page: string; mushaf: string };
  searchParams?: { verse?: string };
}) {
  const page = parsePage(params.page);
  const mushaf = parseMushaf(params.mushaf);
  if (!page || !mushaf) notFound();

  return (
    <Reader
      initialPage={page}
      initialMushaf={mushaf}
      initialHighlightedVerse={searchParams?.verse ?? null}
    />
  );
}
