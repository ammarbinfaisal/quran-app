import { notFound } from "next/navigation";
import { getQuranClient } from "@/lib/quran-client";
import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { TOTAL_JUZS } from "@/lib/constants";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  return Array.from({ length: TOTAL_JUZS }, (_, i) => ({ juz: String(i + 1) }));
}

interface PageProps {
  params: Promise<{ juz: string }>;
}

// Juz → mushaf page mapping (Madani mushaf, 15-line)
// Each juz starts at a known page. This is standard and fixed.
const JUZ_START_PAGES: Record<number, number> = {
  1: 1, 2: 22, 3: 42, 4: 62, 5: 82,
  6: 102, 7: 121, 8: 142, 9: 162, 10: 182,
  11: 201, 12: 222, 13: 242, 14: 262, 15: 282,
  16: 302, 17: 322, 18: 342, 19: 362, 20: 382,
  21: 402, 22: 422, 23: 442, 24: 462, 25: 482,
  26: 502, 27: 522, 28: 542, 29: 562, 30: 582,
};

export default async function JuzPage({ params }: PageProps) {
  const { juz: juzParam } = await params;
  const juzNum = Number(juzParam);

  if (!juzNum || juzNum < 1 || juzNum > TOTAL_JUZS) {
    notFound();
  }

  const startPage = JUZ_START_PAGES[juzNum] ?? 1;
  const endPage = juzNum < TOTAL_JUZS ? (JUZ_START_PAGES[juzNum + 1] ?? 604) - 1 : 604;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title={`Juz ${juzNum}`} backHref="/" />
      <MushafViewer startPage={startPage} endPage={endPage} />
    </div>
  );
}
