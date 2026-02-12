import { type } from "arktype";
import { NextResponse } from "next/server";

const BASE = "https://api.quran.com/api/v4";

const translatorQuerySchema = type("string");

function parseTranslatorIds(raw: string | null): number[] {
  const parsed = translatorQuerySchema(raw ?? "");
  if (parsed instanceof type.errors) return [20];

  const ids = parsed
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);

  return ids.length > 0 ? Array.from(new Set(ids)) : [20];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ verseKey: string }> }
) {
  const { verseKey } = await params;
  const { searchParams } = new URL(request.url);
  const translatorIds = parseTranslatorIds(searchParams.get("translators"));

  try {
    const res = await fetch(
      `${BASE}/verses/by_key/${encodeURIComponent(verseKey)}?translations=${translatorIds.join(",")}&fields=translations`,
      { cache: "force-cache" }
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations = (data.verse?.translations ?? []).map((t: any) => ({
      resourceId: t.resource_id,
      resourceName: t.resource_name ?? null,
      text: t.text,
      verseKey,
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
