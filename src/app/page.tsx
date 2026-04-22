import { HomePageClient } from "@/components/home/HomePageClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function HomePage() {
  return (
    <>
      <JsonLd
        id="home-page-jsonld"
        data={createWebPageJsonLd({
          path: "/",
          title: SITE_NAME,
          description: SITE_DESCRIPTION,
        })}
      />
      <HomePageClient />
    </>
  );
}
