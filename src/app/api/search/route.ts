import { NextRequest, NextResponse } from "next/server";
import type { QuranSearchResponse } from "@/lib/search";

const DEFAULT_SEARCH_API_BASE = "http://127.0.0.1:8080";
const DEFAULT_LIMIT = 30;

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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "query parameter 'q' is required" },
      { status: 400 },
    );
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
  const searchApiBase = process.env.QURAN_SEARCH_API_BASE ?? DEFAULT_SEARCH_API_BASE;

  const upstreamUrl = new URL("/search", searchApiBase);
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

    return NextResponse.json(payload as QuranSearchResponse, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "search service unavailable" },
      { status: 503 },
    );
  }
}
