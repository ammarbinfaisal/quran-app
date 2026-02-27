import { HomePageClient } from "@/components/home/HomePageClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { createWebPageJsonLd } from "@/lib/seo";

export default function HomePage() {
  return (
    <>
      <JsonLd
        id="home-page-jsonld"
        data={createWebPageJsonLd({
          path: "/",
          title: "quran",
          description: "quran app",
        })}
      />
      <HomePageClient />
    </>
  );
}
