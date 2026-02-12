"use client";

import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSettings } from "@/context/SettingsContext";
import { buildCanonicalReaderPath } from "@/lib/preferences";

interface Chapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
  revelationPlace: string;
  translatedName: { name: string };
}

interface Juz {
  id: number;
  juzNumber: number;
  verseMapping: Record<string, string>;
  firstVerseId: number;
  lastVerseId: number;
  versesCount: number;
}

interface HomeClientProps {
  chapters: Chapter[];
  juzs: Juz[];
}

export function HomeClient({ chapters, juzs }: HomeClientProps) {
  const { settings } = useSettings();

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title="Quran" />

      <Tabs defaultValue="chapters" className="flex-1 flex flex-col">
        <div className="sticky top-14 z-30 bg-background border-b border-border">
          <TabsList className="w-full rounded-none h-11 bg-transparent p-0 gap-0">
            <TabsTrigger
              value="chapters"
              className="flex-1 rounded-none h-11 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent font-medium"
            >
              Surahs
            </TabsTrigger>
            <TabsTrigger
              value="juzs"
              className="flex-1 rounded-none h-11 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent font-medium"
            >
              Juzs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chapters" className="flex-1 mt-0">
          <div className="max-w-6xl mx-auto w-full px-4 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={buildCanonicalReaderPath({
                    surah: ch.id,
                    mushafCode: settings.mushafCode,
                    translationCode: settings.translationCode,
                  })}
                  className="group relative flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-4 transition-colors hover:bg-card"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 flex items-center justify-center shrink-0">
                      <div className="w-10 h-10 rotate-45 rounded-lg bg-muted/70 border border-border flex items-center justify-center">
                        <span className="-rotate-45 text-sm font-semibold text-foreground">
                          {ch.id}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {ch.nameSimple}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                        >
                          {ch.revelationPlace === "makkah" ? "Makki" : "Madani"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">
                        {ch.translatedName?.name}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className="text-lg font-medium text-foreground block"
                      style={{ fontFamily: "serif", direction: "rtl" }}
                      translate="no"
                    >
                      {ch.nameArabic}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ch.versesCount} ayahs
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="juzs" className="flex-1 mt-0">
          <div className="max-w-6xl mx-auto w-full px-4 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {juzs.map((juz) => {
                const surahNums = Object.keys(juz.verseMapping);
                const firstSurah = surahNums[0];
                const lastSurah = surahNums[surahNums.length - 1];
                const rangeLabel =
                  firstSurah === lastSurah
                    ? `Surah ${firstSurah}`
                    : `Surah ${firstSurah}–${lastSurah}`;

                return (
                  <Link
                    key={juz.id}
                    href={`/juz/${juz.juzNumber}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-4 transition-colors hover:bg-card"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{juz.juzNumber}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-foreground block">
                          Juz {juz.juzNumber}
                        </span>
                        <p className="text-xs text-muted-foreground truncate">
                          {rangeLabel} · {juz.versesCount} verses
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
