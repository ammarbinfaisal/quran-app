import { getQuranClient } from "@/lib/quran-client";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-static";
export const revalidate = false;

export default async function HomePage() {
  const client = getQuranClient();
  const [chapters, juzs] = await Promise.all([
    client.chapters.findAll(),
    client.juzs.findAll(),
  ]);

  // Serialize to plain objects for the client
  return (
    <HomeClient
      chapters={JSON.parse(JSON.stringify(chapters))}
      juzs={JSON.parse(JSON.stringify(juzs))}
    />
  );
}
