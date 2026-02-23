import fs from "fs";
import path from "path";
import { LemmaViewer } from "@/components/lemma/LemmaViewer";
import { buckwalterToArabic } from "@/lib/transliteration";

export async function generateStaticParams() {
    const dir = path.join(process.cwd(), "public/data/lemmas");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.map((f) => ({
        lemma: encodeURIComponent(f.replace(/\.json$/, "")),
    }));
}

export default async function LemmaRoute({
    params,
}: {
    params: Promise<{ lemma: string }>;
}) {
    const { lemma: encodedLemma } = await params;
    const buckwalter = decodeURIComponent(encodedLemma);
    const arabicLemma = buckwalterToArabic(buckwalter);

    return <LemmaViewer lemma={arabicLemma} mushafCode="v2" />;
}
