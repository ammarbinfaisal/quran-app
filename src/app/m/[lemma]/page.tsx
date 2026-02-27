import { LemmaViewer } from "@/components/lemma/LemmaViewer";
import { JsonLd } from "@/components/seo/JsonLd";
import { buckwalterToArabic } from "@/lib/transliteration";
import { decodeRouteParam } from "@/lib/routeParams";
import { createWebPageJsonLd } from "@/lib/seo";

export const revalidate = 604800; // ISR: 7 days
export const dynamicParams = true;

export async function generateStaticParams() {
    // Build-time generating every lemma creates huge outputs; use on-demand ISR instead.
    return [];
}

export default async function LemmaRoute({
    params,
}: {
    params: Promise<{ lemma: string }>;
}) {
    const { lemma: encodedLemma } = await params;
    const buckwalter = decodeRouteParam(encodedLemma);
    const arabicLemma = buckwalterToArabic(buckwalter);

    return (
        <>
            <JsonLd
                id={`lemma-${buckwalter}-jsonld`}
                data={createWebPageJsonLd({
                    path: `/m/${encodeURIComponent(buckwalter)}`,
                    title: `Lemma ${arabicLemma}`,
                    description: `Browse Quran occurrences for lemma ${arabicLemma}.`,
                })}
            />
            <LemmaViewer lemma={arabicLemma} mushafCode="v2" />
        </>
    );
}
