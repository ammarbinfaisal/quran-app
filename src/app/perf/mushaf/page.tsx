import { NavBar } from "@/components/NavBar";
import { MushafViewer } from "@/components/MushafViewer";
import { getServerSettings } from "@/lib/preferences-server";

export const dynamic = "force-dynamic";

export default async function PerfMushafPage() {
  const settings = await getServerSettings();

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title="Perf: Mushaf" backHref="/" />
      <MushafViewer
        startPage={1}
        endPage={50}
        routeMushafCode={settings.mushafCode}
        routeTranslationCode={settings.translationCode}
      />
    </div>
  );
}

