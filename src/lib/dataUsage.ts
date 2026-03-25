import type { DataUsageMode } from "@/lib/types";

export interface DataUsageModeDetail {
  label: string;
  shortDescription: string;
  docsDescription: string;
}

export const DATA_USAGE_MODES: DataUsageMode[] = ["low", "balanced", "high"];

export const DATA_USAGE_MODE_DETAILS: Record<DataUsageMode, DataUsageModeDetail> = {
  low: {
    label: "Low data",
    shortDescription:
      "Keep background work minimal and fetch only what the current reading step needs.",
    docsDescription:
      "Low data mode avoids proactive warming beyond the current reading action. Fonts still load for the page you open, and translations resolve when you request them, but the app does not keep walking ahead through nearby pages, morphology chunks, or lemma files in the background.",
  },
  balanced: {
    label: "Balanced",
    shortDescription:
      "Warm a small nearby window so the next few pages and verse actions feel immediate.",
    docsDescription:
      "Balanced mode keeps a short buffer around what you are reading now. It can warm a couple of adjacent pages and their related translation data, but it stays intentionally local instead of trying to complete the full surrounding surah or juz.",
  },
  high: {
    label: "Proactive",
    shortDescription:
      "Keep filling the current reading scope in batches, including nearby verse, morphology, and lemma data.",
    docsDescription:
      "Proactive mode uses the widest background window. While you stay in a surah, juz, or page flow, the app keeps batching ahead toward that active scope, including page assets, verse translations, morphology chunks, and nearby lemma files, while still stopping short of a full offline download unless you explicitly ask for one.",
  },
};
