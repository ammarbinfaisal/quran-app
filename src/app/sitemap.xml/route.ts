import { buildSitemapIndexXml } from "@/lib/sitemap";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  const lastmod = new Date().toISOString();
  const xml = buildSitemapIndexXml(lastmod);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
