"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/context/SettingsContext";
import { TRANSLATOR_LABELS } from "@/lib/constants";
import abuIyaadData from "@/data/abu-iyaad.json";

interface TranslationEntry {
  resourceId: number;
  resourceName: string;
  text: string;
  verseKey: string;
}

interface TranslationSheetProps {
  verseKey: string | null; // e.g. "2:255" — null = closed
  onClose: () => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function TranslationSheet({ verseKey, onClose }: TranslationSheetProps) {
  const { settings } = useSettings();
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!verseKey) return;

    setTranslations([]);
    setError(false);
    setLoading(true);

    const ids = settings.apiTranslators.join(",");
    fetch(`/api/translations/${encodeURIComponent(verseKey)}?translators=${ids}`)
      .then((r) => r.json())
      .then((data) => {
        setTranslations(data.translations ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [verseKey, settings.apiTranslators]);

  const abuIyaad = verseKey
    ? (abuIyaadData as Record<string, string>)[verseKey] ?? null
    : null;

  // Build ordered list of entries to display
  function buildEntries() {
    const entries: { label: string; text: string; isAbuIyaad?: boolean }[] = [];

    if (settings.preferAbuIyaad && settings.showAbuIyaad && abuIyaad) {
      entries.push({ label: "Abu Iyaad", text: abuIyaad, isAbuIyaad: true });
    }

    for (const t of translations) {
      const label = TRANSLATOR_LABELS[t.resourceId] ?? t.resourceName ?? "Translation";
      entries.push({ label, text: stripHtml(t.text) });
    }

    if (!settings.preferAbuIyaad && settings.showAbuIyaad && abuIyaad) {
      entries.push({ label: "Abu Iyaad", text: abuIyaad, isAbuIyaad: true });
    }

    return entries;
  }

  return (
    <Sheet open={!!verseKey} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[75dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">
            {verseKey ? `Verse ${verseKey}` : "Translation"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
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
                <p
                  className="text-sm leading-7 text-foreground"
                  translate="no"
                >
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
