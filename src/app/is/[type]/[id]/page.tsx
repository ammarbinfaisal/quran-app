import { ScrollModeReader } from "@/components/reader/ScrollModeReader";
import { InvalidPathMessage } from "@/components/ui/InvalidPathMessage";
import { Suspense } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";
import { INDOPAK_TOTAL_PAGES } from "@/lib/constants";

export async function generateStaticParams() {
  const params = [];

  for (let p = 1; p <= INDOPAK_TOTAL_PAGES; p++) {
    params.push({ type: "p", id: String(p) });
  }

  for (let s = 1; s <= 114; s++) {
    params.push({ type: "s", id: String(s) });
  }

  for (let j = 1; j <= 30; j++) {
    params.push({ type: "j", id: String(j) });
  }

  return params;
}

export default async function IndopakScrollModeRoute({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  if (!/^(p|s|j)$/.test(type) || !/^[0-9]+$/.test(id)) {
    return (
      <InvalidPathMessage
        message={`"/is/${type}/${id}" is not a valid view path.`}
      />
    );
  }

  const validType = type as "p" | "s" | "j";
  const num = Number.parseInt(id, 10);
  const label = validType === "p" ? "Page" : validType === "s" ? "Surah" : "Juz";

  return (
    <>
      <JsonLd
        id={`indopak-scroll-mode-${validType}-${num}-jsonld`}
        data={createWebPageJsonLd({
          path: `/is/${validType}/${num}`,
          title: `Indopak Scroll Mode ${label} ${num}`,
          description: `Read Quran Indopak in scroll mode by ${label.toLowerCase()} ${num}.`,
        })}
      />
      <Suspense>
        <ScrollModeReader type={validType} id={num} forcedMushafCode="indopak" />
      </Suspense>
    </>
  );
}
