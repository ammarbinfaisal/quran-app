"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  getDataManagerStatus,
  purgeTransientData,
  removeDownloadedAssets,
  type DataManagerStatus,
} from "@/lib/offline/dataManager";
import { MUSHAF_DISPLAY_NAMES, TRANSLATION_DISPLAY_NAMES } from "@/lib/types";
import { ConfirmActionButton } from "@/components/settings/ConfirmActionButton";

export function DataManagerSection() {
  const [status, setStatus] = useState<DataManagerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setStatus(await getDataManagerStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read saved data status.");
    }
  }

  useMountEffect(() => {
    void refreshStatus();
  });

  const downloadedLabels = [
    ...(status?.downloadedMushafs ?? []).map(
      (code) => `Mushaf ${MUSHAF_DISPLAY_NAMES[code] ?? code}`,
    ),
    ...(status?.downloadedTranslations ?? []).map(
      (id) => TRANSLATION_DISPLAY_NAMES[id] ?? id,
    ),
    ...(status?.morphologyDownloaded ? ["Morphology"] : []),
    ...(status?.lemmasDownloaded ? ["Lemma index"] : []),
  ];

  async function handlePurgeTransientData() {
    setError(null);
    try {
      await purgeTransientData();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purge cached data.");
    }
  }

  async function handleRemoveDownloadedAssets() {
    setError(null);
    try {
      await removeDownloadedAssets();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove downloaded assets.");
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Data Manager
      </h3>
      <div className="space-y-3 rounded-2xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-3">
        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-muted)]/15 bg-[var(--color-surface)] p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
            <Database className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)]">Saved data</p>
            <p className="mt-1 text-pretty text-sm leading-6 text-[var(--color-muted)]">
              {downloadedLabels.length > 0
                ? downloadedLabels.join(", ")
                : "No full offline downloads are currently saved."}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ConfirmActionButton
            triggerLabel="Purge cache"
            title="Purge cached reading data?"
            description="This removes background reading data and browser caches, but keeps your explicit offline downloads. The app may download some of this again as you continue reading."
            confirmLabel="Purge cache"
            busyLabel="Purging..."
            onConfirm={handlePurgeTransientData}
          />
          <ConfirmActionButton
            triggerLabel="Remove downloads"
            title="Remove downloaded assets?"
            description="This deletes assets you explicitly saved for offline use, including downloaded mushaf files, translations, morphology, and lemma data."
            confirmLabel="Remove downloads"
            busyLabel="Removing..."
            onConfirm={handleRemoveDownloadedAssets}
            disabled={!status?.hasDownloadedAssets}
            tone="danger"
          />
        </div>

        {error && (
          <p aria-live="polite" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
