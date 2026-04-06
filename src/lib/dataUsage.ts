import type { DataUsageMode } from "@/lib/types";

export interface DataUsageModeDetail {
  label: string;
  shortDescription: string;
  docsDescription: string;
}

export interface DataUsagePolicy {
  adjacentPageRadius: number;
  pageModeLookaheadRadius: number;
  completeScopeAssets: boolean;
  prefetchTranslations: "none" | "adjacent" | "scope";
  prefetchMorphology: boolean;
  lemmaPageRadius: number;
  maxLemmaFilesPerPage: number;
  occurrenceBatchSize: number;
}

export const DATA_USAGE_MODES: DataUsageMode[] = ["low", "balanced", "high"];

export const DATA_USAGE_MODE_DETAILS: Record<DataUsageMode, DataUsageModeDetail> = {
  low: {
    label: "Low data",
    shortDescription:
      "Download only what the current page or action needs.",
    docsDescription:
      "Low data mode keeps background downloading to a minimum. The app brings in what is needed for the page you open and for features you choose to use, but it does not keep pulling in nearby material on its own.",
  },
  balanced: {
    label: "Balanced",
    shortDescription:
      "Quietly download a small amount around where you are reading.",
    docsDescription:
      "Balanced mode quietly downloads a small amount around your current place so nearby pages and common verse actions feel more ready. It stays close to where you are reading rather than trying to fill a whole surah or juz.",
  },
  high: {
    label: "High data",
    shortDescription:
      "Keep downloading more of the current area while you continue reading.",
    docsDescription:
      "High data mode keeps working further ahead in the background while you remain in the same reading flow. Over time it can gather more of the current surah, juz, or nearby study data, but it still does not replace a full offline download unless you choose one.",
  },
};

export const DATA_USAGE_POLICIES: Record<DataUsageMode, DataUsagePolicy> = {
  low: {
    adjacentPageRadius: 0,
    pageModeLookaheadRadius: 0,
    completeScopeAssets: false,
    prefetchTranslations: "none",
    prefetchMorphology: false,
    lemmaPageRadius: 0,
    maxLemmaFilesPerPage: 0,
    occurrenceBatchSize: 3,
  },
  balanced: {
    adjacentPageRadius: 2,
    pageModeLookaheadRadius: 2,
    completeScopeAssets: false,
    prefetchTranslations: "adjacent",
    prefetchMorphology: false,
    lemmaPageRadius: 0,
    maxLemmaFilesPerPage: 0,
    occurrenceBatchSize: 5,
  },
  high: {
    adjacentPageRadius: 4,
    pageModeLookaheadRadius: 6,
    completeScopeAssets: true,
    prefetchTranslations: "scope",
    prefetchMorphology: true,
    lemmaPageRadius: 1,
    maxLemmaFilesPerPage: 8,
    occurrenceBatchSize: 10,
  },
};
