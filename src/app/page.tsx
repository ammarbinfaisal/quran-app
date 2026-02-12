import { fetchChapters, fetchJuzs } from "@/lib/quran-client";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-static";
export const revalidate = false;

export default async function HomePage() {
  const [chapters, juzs] = await Promise.all([
    fetchChapters(),
    fetchJuzs(),
  ]);

  return (
    <HomeClient
      chapters={chapters}
      juzs={juzs}
    />
  );
}
