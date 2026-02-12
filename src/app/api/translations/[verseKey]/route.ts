import { NextResponse } from "next/server";
import { getQuranClient } from "@/lib/quran-client";
import type { VerseKey } from "@quranjs/api";

// GET /api/translations/2:255?translators=20,85
export async function GET(
  request: Request,
  { params }: { params: Promise<{ verseKey: string }> }
) {
  const { verseKey } = await params;
  const { searchParams } = new URL(request.url);
  const translatorsParam = searchParams.get("translators") ?? "20";
  const translatorIds = translatorsParam
    .split(",")
    .map(Number)
    .filter(Boolean);

  try {
    const client = getQuranClient();
    const verse = await client.verses.findByKey(verseKey as VerseKey, {
      translations: translatorIds,
      translationFields: { resourceName: true, verseKey: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations = ((verse as any).translations ?? []).map((t: {
      resourceId?: number;
      resourceName?: string;
      text: string;
      verseKey?: string;
    }) => ({
      resourceId: t.resourceId,
      resourceName: t.resourceName,
      text: t.text,
      verseKey: t.verseKey ?? verseKey,
    }));

    return NextResponse.json({ translations });
  } catch (err) {
    console.error("[api/translations]", err);
    return NextResponse.json(
      { error: "Failed to fetch translations" },
      { status: 500 }
    );
  }
}
