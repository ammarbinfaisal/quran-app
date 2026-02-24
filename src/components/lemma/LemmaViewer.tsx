"use client";

import { arabicToBuckwalter } from "@/lib/transliteration";
import { type MushafCode } from "@/lib/types";
import { OccurrenceViewer } from "@/components/occurrence/OccurrenceViewer";

export function LemmaViewer({
    lemma,
    mushafCode,
}: {
    lemma: string;
    mushafCode: MushafCode;
}) {
    const bw = arabicToBuckwalter(lemma);
    const dataUrl = `/data/lemmas/${encodeURIComponent(bw)}.json`;

    return (
        <OccurrenceViewer
            displayArabic={lemma}
            subtitle="Lemma Lookup"
            dataUrl={dataUrl}
            mushafCode={mushafCode}
            showModeToggle={false}
        />
    );
}
