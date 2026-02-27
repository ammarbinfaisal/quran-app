import { Suspense } from "react";
import { SearchViewer } from "@/components/search/SearchViewer";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";

export default function SearchPage() {
  return (
    <>
      <JsonLd
        id="search-page-jsonld"
        data={createWebPageJsonLd({
          path: "/search",
          title: "Search",
          description: "Search Quran verses and jump directly to the matching ayah.",
        })}
      />
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg)] text-sm text-[var(--color-muted)]">
            Loading…
          </div>
        }
      >
        <SearchViewer />
      </Suspense>
    </>
  );
}
