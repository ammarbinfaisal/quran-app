import { type NextRequest } from "next/server";
import { buildSitemapXml, getSitemapChunkById } from "@/lib/sitemap";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const last = pathname.split("/").pop() ?? "";
  const id = last.replace(/\.xml$/, "");
  const chunk = getSitemapChunkById(id);

  if (!chunk) {
    return new Response("Not found", { status: 404 });
  }

  const lastmod = new Date().toISOString();
  const xml = buildSitemapXml(chunk, lastmod);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
