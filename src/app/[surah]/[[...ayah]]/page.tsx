import { notFound } from "next/navigation";
import { getQuranClient } from "@/lib/quran-client";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_SURAHS } from "@/lib/constants";
import type { Chapter } from "@quranjs/api";

export const dynamic = "force-static";
export const revalidate = false;

// Cache all chapters once across static generation
let _chapters: Chapter[] | null = null;
async function getAllChapters(): Promise<Chapter[]> {
  if (!_chapters) {
    _chapters = await getQuranClient().chapters.findAll();
  }
  return _chapters;
}

export async function generateStaticParams() {
  return Array.from({ length: TOTAL_SURAHS }, (_, i) => ({
    surah: String(i + 1),
  }));
}

interface PageProps {
  params: Promise<{ surah: string; ayah?: string[] }>;
}

export default async function SurahPage({ params }: PageProps) {
  const { surah: surahParam, ayah: ayahParam } = await params;
  const surahNum = Number(surahParam);

  if (!surahNum || surahNum < 1 || surahNum > TOTAL_SURAHS) {
    notFound();
  }

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.id === surahNum);
  if (!chapter) notFound();

  const startPage: number = chapter.pages[0] ?? 1;
  const endPage: number = chapter.pages[1] ?? startPage;

  const ayahNum = ayahParam?.[0] ? Number(ayahParam[0]) : undefined;
  const initialAyah = ayahNum ? `${surahNum}:${ayahNum}` : undefined;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title={`${surahNum}. ${chapter.nameSimple}`} backHref="/" />
      <MushafViewer
        startPage={startPage}
        endPage={endPage}
        initialAyah={initialAyah}
      />
    </div>
  );
}
