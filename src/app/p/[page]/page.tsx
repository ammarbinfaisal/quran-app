import { notFound } from "next/navigation";
import { TOTAL_PAGES } from "@/lib/constants";
import { Reader } from "@/components/reader/Reader";
import { Suspense } from "react";

export async function generateStaticParams() {
  const params = [];
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    params.push({ page: String(p) });
  }
  return params;
}

function parsePage(page: string): number | null {
  const n = parseInt(page, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > TOTAL_PAGES) return null;
  return n;
}

export default async function MushafPageRoute({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: pageParam } = await params;

  const page = parsePage(pageParam);
  if (page == null) notFound();

  return (
    <Suspense>
      <Reader initialPage={page} />
    </Suspense>
  );
}
