import { NextRequest, NextResponse } from "next/server";
import type { QuranSearchResponse } from "@/lib/search";

const DEFAULT_LIMIT = 30;
const TARTEEL_SEARCH_URL = "https://search.quran.tarteel.tv/search";

export const dynamic = "force-dynamic";

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(500, Math.max(1, parsed));
}

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (!("error" in payload)) return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim().length > 0 ? error : null;
}

function normalizeUpstreamResponse(payload: unknown): QuranSearchResponse | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;

  const query = typeof obj.query === "string" ? obj.query : null;
  const normalizedQuery =
    typeof obj.normalized_query === "string" ? obj.normalized_query : null;
  const totalMatches = typeof obj.total_matches === "number" ? obj.total_matches : null;
  const limitedTo = typeof obj.limited_to === "number" ? obj.limited_to : null;
  const cacheHit = typeof obj.cache_hit === "boolean" ? obj.cache_hit : null;
  const resultsRaw = Array.isArray(obj.results) ? obj.results : null;

  if (
    query === null ||
    normalizedQuery === null ||
    totalMatches === null ||
    limitedTo === null ||
    cacheHit === null ||
    resultsRaw === null
  ) {
    return null;
  }

  const results = resultsRaw
    .map((hit) => {
      if (typeof hit !== "object" || hit === null) return null;
      const verseKey = (hit as { verse_key?: unknown }).verse_key;
      if (typeof verseKey !== "string" || verseKey.trim().length === 0) return null;
      return { verse_key: verseKey };
    })
    .filter((x): x is { verse_key: string } => x !== null);

  return {
    query,
    normalized_query: normalizedQuery,
    total_matches: totalMatches,
    limited_to: limitedTo,
    cache_hit: cacheHit,
    results,
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "query parameter 'q' is required" },
      { status: 400 },
    );
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
  const upstreamUrl = new URL(TARTEEL_SEARCH_URL);
  upstreamUrl.searchParams.set("q", q);
  upstreamUrl.searchParams.set("limit", String(limit));

  try {
    const upstream = await fetch(upstreamUrl.toString(), { cache: "no-store" });
    const payload = (await upstream.json().catch(() => null)) as unknown;

    if (!upstream.ok) {
      return NextResponse.json(
        { error: getErrorMessage(payload) ?? `search failed (${upstream.status})` },
        { status: upstream.status },
      );
    }

    const normalized = normalizeUpstreamResponse(payload);
    if (!normalized) {
      return NextResponse.json({ error: "invalid search response" }, { status: 502 });
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "search service unavailable" },
      { status: 503 },
    );
  }
}
