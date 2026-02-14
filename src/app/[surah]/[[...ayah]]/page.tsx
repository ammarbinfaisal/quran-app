import { notFound } from "next/navigation";
import { fetchChapters, type Chapter } from "@/lib/quran-client";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_SURAHS } from "@/lib/constants";
import { parseReaderRouteSegments, DEFAULT_SETTINGS } from "@/lib/preferences";
import { getMushafPagePayload, getCriticalFontStyles } from "@/lib/mushaf-server";

// Pre-render all 114 Surahs as static pages.
// Canonical routes (e.g. /1/r/m:v2/t:tr20) are ISR'd on first visit.
//
// Decision: removed getServerSettings() (cookies() call) which forced
// all pages to be dynamic. Bare routes (/1, /2, etc.) use DEFAULT_SETTINGS
// because middleware redirects users with cookie-based preferences to
// canonical routes before the page is ever reached. Canonical routes
// carry settings in the URL.
export async function generateStaticParams() {
  return Array.from({ length: TOTAL_SURAHS }, (_, i) => ({
    surah: (i + 1).toString(),
    ayah: [],
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

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.id === surahNum);
  if (!chapter) notFound();

  const startPage: number = chapter.pages[0] ?? 1;
  const endPage: number = chapter.pages[1] ?? startPage;
  const initialAyah = route.ayah ? `${surahNum}:${route.ayah}` : undefined;

  // Canonical routes carry mushaf/translation codes in the URL.
  // Bare routes use defaults (middleware redirects preference-holding users).
  const effectiveMushafCode =
    route.kind === "canonical" ? route.mushafCode : DEFAULT_SETTINGS.mushafCode;
  const effectiveTranslationCode =
    route.kind === "canonical"
      ? route.translationCode
      : DEFAULT_SETTINGS.translationCode;

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
