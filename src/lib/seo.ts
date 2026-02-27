const LOCAL_FALLBACK_URL = "http://localhost:3000";

export const SITE_NAME = "quran";
export const SITE_DESCRIPTION = "quran app";

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : LOCAL_FALLBACK_URL);

  try {
    return new URL(raw).origin;
  } catch {
    return LOCAL_FALLBACK_URL;
  }
}

export function absoluteUrl(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return new URL(safePath, getSiteUrl()).toString();
}

export type JsonLd = Record<string, unknown>;

export function stringifyJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

interface WebPageJsonLdOptions {
  path: string;
  title: string;
  description: string;
}

export function createWebPageJsonLd({
  path,
  title,
  description,
}: WebPageJsonLdOptions): JsonLd {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };
}

export function createWebSiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: absoluteUrl("/search?q={search_term_string}"),
      "query-input": "required name=search_term_string",
    },
  };
}
