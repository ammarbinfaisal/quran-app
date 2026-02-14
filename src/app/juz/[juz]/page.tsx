import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_JUZS } from "@/lib/constants";
import { DEFAULT_SETTINGS } from "@/lib/preferences";
import { getMushafPagePayload, getCriticalFontStyles } from "@/lib/mushaf-server";

interface PageProps {
  params: Promise<{ juz: string }>;
}

export async function generateStaticParams() {
  return Array.from({ length: TOTAL_JUZS }, (_, i) => ({
    juz: (i + 1).toString(),
  }));
}

const JUZ_START_PAGES: Record<number, number> = {
  1: 1,
  2: 22,
  3: 42,
  4: 62,
  5: 82,
  6: 102,
  7: 121,
  8: 142,
  9: 162,
  10: 182,
  11: 201,
  12: 222,
  13: 242,
  14: 262,
  15: 282,
  16: 302,
  17: 322,
  18: 342,
  19: 362,
  20: 382,
  21: 402,
  22: 422,
  23: 442,
  24: 462,
  25: 482,
  26: 502,
  27: 522,
  28: 542,
  29: 562,
  30: 582,
};

export default async function JuzPage({ params }: PageProps) {
  const { juz: juzParam } = await params;
  const juzNum = Number(juzParam);

  if (!juzNum || juzNum < 1 || juzNum > TOTAL_JUZS) {
    notFound();
  }

  // Use DEFAULT_SETTINGS instead of reading cookies.
  // Same reasoning as surah pages: middleware handles preference redirects.
  const mushafCode = DEFAULT_SETTINGS.mushafCode;
  const translationCode = DEFAULT_SETTINGS.translationCode;

  const startPage = JUZ_START_PAGES[juzNum] ?? 1;
  const endPage =
    juzNum < TOTAL_JUZS ? (JUZ_START_PAGES[juzNum + 1] ?? 604) - 1 : 604;

  const initialData = await getMushafPagePayload(mushafCode, startPage);
  const initialFontStyles = getCriticalFontStyles(mushafCode, startPage);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title={`Juz ${juzNum}`} backHref="/" />
      <MushafViewer
        startPage={startPage}
        endPage={endPage}
        routeMushafCode={mushafCode}
        routeTranslationCode={translationCode}
        initialData={initialData}
        initialFontStyles={initialFontStyles}
      />
    </div>
  );
}
