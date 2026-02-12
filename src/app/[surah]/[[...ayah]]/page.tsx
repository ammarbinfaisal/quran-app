import { notFound, redirect } from "next/navigation";
import { fetchChapters, type Chapter } from "@/lib/quran-client";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_SURAHS } from "@/lib/constants";
import {
  buildCanonicalReaderPath,
  parseReaderRouteSegments,
} from "@/lib/preferences";
import { getServerSettings } from "@/lib/preferences-server";

export const dynamic = "force-dynamic";

let chaptersCache: Chapter[] | null = null;

async function getAllChapters(): Promise<Chapter[]> {
  if (!chaptersCache) {
    chaptersCache = await fetchChapters();
  }
  return chaptersCache;
}

interface PageProps {
  params: Promise<{ surah: string; ayah?: string[] }>;
}

export default async function SurahPage({ params }: PageProps) {
  const { surah: surahParam, ayah: routeSegments } = await params;
  const surahNum = Number(surahParam);

  if (!surahNum || surahNum < 1 || surahNum > TOTAL_SURAHS) {
    notFound();
  }

  const route = parseReaderRouteSegments(routeSegments);

  if (route.kind === "invalid") {
    notFound();
  }

  const settings = await getServerSettings();

  if (route.kind === "bare") {
    redirect(
      buildCanonicalReaderPath({
        surah: surahNum,
        ayah: route.ayah,
        mushafCode: settings.mushafCode,
        translationCode: settings.translationCode,
      })
    );
  }

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.id === surahNum);
  if (!chapter) {
    notFound();
  }

  const startPage: number = chapter.pages[0] ?? 1;
  const endPage: number = chapter.pages[1] ?? startPage;
  const initialAyah = route.ayah ? `${surahNum}:${route.ayah}` : undefined;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title={`${surahNum}. ${chapter.nameSimple}`} backHref="/" />
      <MushafViewer
        startPage={startPage}
        endPage={endPage}
        initialAyah={initialAyah}
        routeMushafCode={route.mushafCode}
        routeTranslationCode={route.translationCode}
      />
    </div>
  );
}
