import { TafsirReader } from "@/components/tafsir/TafsirReader";
import { InvalidPathMessage } from "@/components/ui/InvalidPathMessage";
import { TAFSIR_IDS } from "@/lib/types";
import { getChapters } from "@/lib/chapters";
import { Suspense } from "react";

export async function generateStaticParams() {
  const chapters = getChapters();
  const params = [];

  for (const tafsirId of TAFSIR_IDS) {
    for (const ch of chapters) {
      for (let a = 1; a <= ch.versesCount; a++) {
        params.push({
          tafsirId,
          surahId: String(ch.id),
          ayahId: String(a),
        });
      }
    }
  }

  return params;
}

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
