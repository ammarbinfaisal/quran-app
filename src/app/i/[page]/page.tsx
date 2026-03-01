import { notFound } from "next/navigation";
import { INDOPAK_TOTAL_PAGES } from "@/lib/constants";
import { Reader } from "@/components/reader/Reader";
import { Suspense } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  const params = [];
  for (let p = 1; p <= INDOPAK_TOTAL_PAGES; p++) {
    params.push({ page: String(p) });
  }
  return params;
}

function parsePage(page: string): number | null {
  const n = parseInt(page, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > INDOPAK_TOTAL_PAGES) return null;
  return n;
}

export default async function IndopakMushafPageRoute({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: pageParam } = await params;

  const page = parsePage(pageParam);
  if (page == null) notFound();

  return (
    <>
      <JsonLd
        id={`indopak-page-${page}-jsonld`}
        data={createWebPageJsonLd({
          path: `/i/${page}`,
          title: `Indopak Page ${page}`,
          description: `Read Quran Indopak mushaf page ${page}.`,
        })}
      />
      <Suspense>
        <Reader initialPage={page} forcedMushafCode="indopak" />
      </Suspense>
    </>
  );
}
