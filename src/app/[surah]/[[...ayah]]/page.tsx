import { notFound } from "next/navigation";
import { fetchChapters, type Chapter } from "@/lib/quran-client";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_SURAHS } from "@/lib/constants";
import { parseReaderRouteSegments } from "@/lib/preferences";
import { getServerSettings } from "@/lib/preferences-server";
import { getMushafPagePayload, getCriticalFontStyles } from "@/lib/mushaf-server";

export const dynamic = "auto";

// Pre-render all 114 Surahs
export async function generateStaticParams() {
  return Array.from({ length: TOTAL_SURAHS }, (_, i) => ({
    surah: (i + 1).toString(),
    ayah: [], // Generates the base /1, /2, etc. paths
  }));
}

let chaptersCache: Chapter[] | null = null;
async function getAllChapters(): Promise<Chapter[]> {
  if (!chaptersCache) chaptersCache = await fetchChapters();
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
  if (route.kind === "invalid") notFound();

  const settings = await getServerSettings();

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.id === surahNum);
  if (!chapter) notFound();

  const startPage: number = chapter.pages[0] ?? 1;
  const endPage: number = chapter.pages[1] ?? startPage;
  const initialAyah = route.ayah ? `${surahNum}:${route.ayah}` : undefined;

  const effectiveMushafCode =
    route.kind === "canonical" ? route.mushafCode : settings.mushafCode;
  const effectiveTranslationCode =
    route.kind === "canonical" ? route.translationCode : settings.translationCode;

  const initialData = await getMushafPagePayload(effectiveMushafCode, startPage);
  const initialFontStyles = getCriticalFontStyles(effectiveMushafCode, startPage);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title={`${surahNum}. ${chapter.nameSimple}`} backHref="/" />
      <MushafViewer
        startPage={startPage}
        endPage={endPage}
        initialAyah={initialAyah}
        routeMushafCode={effectiveMushafCode}
        routeTranslationCode={effectiveTranslationCode}
        initialData={initialData}
        initialFontStyles={initialFontStyles}
      />
    </div>
  );
}
