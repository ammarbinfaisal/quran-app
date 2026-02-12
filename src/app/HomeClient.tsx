"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
          <div className="divide-y divide-border">
            {chapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/${ch.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors"
              >
                {/* Number badge */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{ch.id}</span>
                </div>

                {/* Names */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {ch.nameSimple}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {ch.revelationPlace === "makkah" ? "Makki" : "Madani"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ch.translatedName?.name} · {ch.versesCount} verses
                  </span>
                </div>

                {/* Arabic name */}
                <span
                  className="text-lg font-medium text-foreground shrink-0"
                  style={{ fontFamily: "serif", direction: "rtl" }}
                  translate="no"
                >
                  {ch.nameArabic}
                </span>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="juzs" className="flex-1 mt-0">
          <div className="divide-y divide-border">
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
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">{juz.juzNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground">
                      Juz {juz.juzNumber}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {rangeLabel} · {juz.versesCount} verses
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
