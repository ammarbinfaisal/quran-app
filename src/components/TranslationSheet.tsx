"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/context/SettingsContext";
import { TRANSLATOR_LABELS } from "@/lib/constants";
import { getTranslationIdsForApi } from "@/lib/preferences";

// Lazy-loaded Abu Iyaad data. The JSON is 434KB — loading it eagerly
// as a static import adds it to the initial bundle even when the
// translation sheet is never opened. This lazy approach only fetches
// the data when the sheet opens and the setting is enabled.
let abuIyaadCache: Record<string, string> | null = null;
let abuIyaadPromise: Promise<Record<string, string>> | null = null;

function loadAbuIyaad(): Promise<Record<string, string>> {
  if (abuIyaadCache) return Promise.resolve(abuIyaadCache);
  if (!abuIyaadPromise) {
    abuIyaadPromise = import("@/data/abu-iyaad.json").then((mod) => {
      abuIyaadCache = mod.default as Record<string, string>;
      return abuIyaadCache;
    });
  }
  return abuIyaadPromise;
}

interface TranslationEntry {
  resourceId: number;
  resourceName: string;
  text: string;
  verseKey: string;
}

interface TranslationSheetProps {
  verseKey: string | null;
  onClose: () => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function TranslationSheet({ verseKey, onClose }: TranslationSheetProps) {
  const { settings } = useSettings();
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [abuIyaad, setAbuIyaad] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const translationIds = useMemo(
    () => getTranslationIdsForApi(settings),
    [settings]
  );

  // Load Abu Iyaad data lazily when sheet opens and setting is enabled
  useEffect(() => {
    if (!verseKey || !settings.showAbuIyaad) {
      setAbuIyaad(null);
      return;
    }

    let cancelled = false;
    loadAbuIyaad().then((data) => {
      if (cancelled) return;
      setAbuIyaad(data[verseKey] ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [verseKey, settings.showAbuIyaad]);

  useEffect(() => {
    if (!verseKey) return;

    let cancelled = false;

    if (translationIds.length === 0) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setTranslations([]);
        setError(false);
        setLoading(false);
      });
      return;
    }

    const ids = translationIds.join(",");

    Promise.resolve().then(() => {
      if (cancelled) return;
      setTranslations([]);
      setError(false);
      setLoading(true);
    });

    fetch(`/api/translations/${encodeURIComponent(verseKey)}?translators=${ids}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTranslations(data.translations ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [verseKey, translationIds]);

  function buildEntries() {
    const entries: { label: string; text: string }[] = [];

    if (settings.preferAbuIyaad && settings.showAbuIyaad && abuIyaad) {
      entries.push({ label: "Abu Iyaad", text: abuIyaad });
    }

    for (const t of translations) {
      const label = TRANSLATOR_LABELS[t.resourceId] ?? t.resourceName ?? "Translation";
      entries.push({ label, text: stripHtml(t.text) });
    }

    if (!settings.preferAbuIyaad && settings.showAbuIyaad && abuIyaad) {
      entries.push({ label: "Abu Iyaad", text: abuIyaad });
    }

    return entries;
  }

  return (
    <Sheet open={!!verseKey} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[75dvh] overflow-y-auto rounded-t-2xl inset-x-0 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[600px] sm:rounded-t-2xl"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">
            {verseKey ? `Verse ${verseKey}` : "Translation"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6 px-4">
          {loading && (
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-full" />
              <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-destructive">Failed to load translations.</p>
          )}

          {!loading &&
            buildEntries().map((entry, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-4" />}
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {entry.label}
                </p>
                <p className="text-sm leading-7 text-foreground" translate="no">
                  {entry.text}
                </p>
              </div>
            ))}

          {!loading && !error && buildEntries().length === 0 && (
            <p className="text-sm text-muted-foreground">
              No translation available for this verse.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
