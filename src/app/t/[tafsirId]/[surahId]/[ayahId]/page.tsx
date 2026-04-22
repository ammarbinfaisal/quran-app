import { TafsirReader } from "@/components/tafsir/TafsirReader";
import { InvalidPathMessage } from "@/components/ui/InvalidPathMessage";
import { TAFSIR_IDS } from "@/lib/types";
import { getChapters } from "@/lib/chapters";
import { Suspense } from "react";

// Tafsir pages are rendered on-demand. With 6 tafaseer × ~6200 ayaat ≈ 37k
// static HTML files, prerendering exceeds Vercel's per-deployment file-count
// limit and breaks deploys. Client fetches the tafsir JSON directly, so SSR
// on-demand is fast enough without SSG.
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function TafsirRoute({
  params,
}: {
  params: Promise<{ tafsirId: string; surahId: string; ayahId: string }>;
}) {
  const { tafsirId, surahId, ayahId } = await params;

  const validTafsirId = TAFSIR_IDS.find((id) => id === tafsirId);
  if (!validTafsirId || !/^[0-9]+$/.test(surahId) || !/^[0-9]+$/.test(ayahId)) {
    return (
      <InvalidPathMessage
        message={`"/t/${tafsirId}/${surahId}/${ayahId}" is not a valid tafsir path.`}
      />
    );
  }

  const surah = parseInt(surahId, 10);
  const ayah = parseInt(ayahId, 10);
  const chapters = getChapters();
  const chapter = chapters.find((c) => c.id === surah);

  if (!chapter || ayah < 1 || ayah > chapter.versesCount) {
    return (
      <InvalidPathMessage
        message={`Verse ${surah}:${ayah} does not exist.`}
      />
    );
  }

  return (
    <Suspense>
      <TafsirReader
        key={`${validTafsirId}:${surah}:${ayah}`}
        tafsirId={validTafsirId}
        surahId={surah}
        ayahId={ayah}
      />
    </Suspense>
  );
}
