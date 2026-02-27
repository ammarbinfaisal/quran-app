import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getSitemapChunks } from "@/lib/sitemap";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return getSitemapChunks().flatMap((chunk) =>
    chunk.paths.map((routePath) => ({
      url: absoluteUrl(routePath),
      lastModified,
      changeFrequency: chunk.changefreq,
      priority: chunk.priority,
    })),
  );
}
