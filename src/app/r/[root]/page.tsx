import fs from "fs";
import path from "path";
import { OccurrenceViewer } from "@/components/occurrence/OccurrenceViewer";
import { buckwalterToArabic } from "@/lib/transliteration";
import { decodeRouteParam } from "@/lib/routeParams";

export async function generateStaticParams() {
    const dir = path.join(process.cwd(), "public/data/roots");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.map((f) => ({
        root: f.replace(/\.json$/, ""),
    }));
}

export default async function RootRoute({
    params,
}: {
    params: Promise<{ root: string }>;
}) {
    const { root: encodedRoot } = await params;
    const buckwalter = decodeRouteParam(encodedRoot);
    const arabicRoot = buckwalterToArabic(buckwalter);
    const dataUrl = `/data/roots/${encodeURIComponent(buckwalter)}.json`;

    return (
        <OccurrenceViewer
            displayArabic={arabicRoot}
            subtitle="Root"
            dataUrl={dataUrl}
            mushafCode="v2"
            showModeToggle={false}
        />
    );
}
