import { OccurrenceViewer } from "@/components/occurrence/OccurrenceViewer";
import { JsonLd } from "@/components/seo/JsonLd";
import { buckwalterToArabic } from "@/lib/transliteration";
import { decodeRouteParam } from "@/lib/routeParams";
import { rootToFilename } from "@/lib/rootFilename";
import { createWebPageJsonLd } from "@/lib/seo";

export const revalidate = 604800; // ISR: 7 days
export const dynamicParams = true;

export async function generateStaticParams() {
    // Build-time generating every root creates huge outputs; use on-demand ISR instead.
    return [];
}

export default async function RootRoute({
    params,
}: {
    params: Promise<{ root: string }>;
}) {
    const { root: encodedRoot } = await params;
    const buckwalter = decodeRouteParam(encodedRoot);
    const arabicRoot = buckwalterToArabic(buckwalter);
    const dataUrl = `/data/roots/${encodeURIComponent(rootToFilename(buckwalter))}.json`;

    return (
        <>
            <JsonLd
                id={`root-${buckwalter}-jsonld`}
                data={createWebPageJsonLd({
                    path: `/r/${encodeURIComponent(buckwalter)}`,
                    title: `Root ${arabicRoot}`,
                    description: `Browse Quran occurrences for root ${arabicRoot}.`,
                })}
            />
            <OccurrenceViewer
                displayArabic={arabicRoot}
                subtitle="Root"
                dataUrl={dataUrl}
                mushafCode="v2"
                showModeToggle={false}
            />
        </>
    );
}
