import { NextRequest, NextResponse } from "next/server";
import { serverSearch } from "@/lib/search/server";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from "@/lib/search/constants";

export const dynamic = "force-dynamic";

// Results are a pure function of the committed index, so let the CDN keep them.
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

function clampLimit(raw: string | null): number {
  if (!raw) return SEARCH_DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return SEARCH_DEFAULT_LIMIT;
  return Math.min(SEARCH_MAX_LIMIT, Math.max(1, parsed));
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "query parameter 'q' is required" }, { status: 400 });
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  let outcome;
  try {
    outcome = serverSearch(q, limit);
  } catch {
    return NextResponse.json({ error: "search index unavailable" }, { status: 503 });
  }

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json(outcome.response, {
    status: 200,
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
