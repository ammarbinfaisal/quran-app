"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, Check, Loader2, X } from "lucide-react";
import {
  type MushafCode,
  type TranslationId,
  type DownloadProgress,
  MUSHAF_CODES,
  MUSHAF_DISPLAY_NAMES,
  TRANSLATION_DISPLAY_NAMES,
} from "@/lib/types";
import {
  downloadMushaf,
  removeMushaf,
  downloadTranslation,
  downloadAbuIyaad,
  removeTranslation,
} from "@/lib/offline/download";
import {
  getDownloadedMushafs,
  getDownloadedTranslations,
} from "@/lib/offline/status";

const ALL_TRANSLATION_IDS: TranslationId[] = ["saheeh", "hilali-khan", "abu-iyaad"];

interface DownloadManagerProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadManager({ open, onClose }: DownloadManagerProps) {
  const [downloadedMushafs, setDownloadedMushafs] = useState<MushafCode[]>([]);
  const [downloadedTranslations, setDownloadedTranslations] = useState<TranslationId[]>([]);

  // Track active downloads by key (mushaf code or translation id)
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadProgress>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshStatus = useCallback(async () => {
    try {
      const [mushafs, translations] = await Promise.all([
        getDownloadedMushafs(),
        getDownloadedTranslations(),
      ]);
      setDownloadedMushafs(mushafs);
      setDownloadedTranslations(translations);
    } catch {
      // IndexedDB may be unavailable
    }
  }, []);

  useEffect(() => {
    if (open) {
      refreshStatus();
    }
  }, [open, refreshStatus]);

  // -----------------------------------------------------------------------
  // Mushaf handlers
  // -----------------------------------------------------------------------

  const handleDownloadMushaf = useCallback(
    async (code: MushafCode) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });

      try {
        await downloadMushaf(code, (progress) => {
          setActiveDownloads((prev) => ({ ...prev, [code]: progress }));
        });
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
        await refreshStatus();
      } catch (err) {
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [code]: err instanceof Error ? err.message : "Download failed",
        }));
      }
    },
    [refreshStatus],
  );

  const handleRemoveMushaf = useCallback(
    async (code: MushafCode) => {
      try {
        await removeMushaf(code);
        await refreshStatus();
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [code]: err instanceof Error ? err.message : "Remove failed",
        }));
      }
    },
    [refreshStatus],
  );

  // -----------------------------------------------------------------------
  // Translation handlers
  // -----------------------------------------------------------------------

  const handleDownloadTranslation = useCallback(
    async (id: TranslationId) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      try {
        if (id === "abu-iyaad") {
          await downloadAbuIyaad((progress) => {
            setActiveDownloads((prev) => ({ ...prev, [id]: progress }));
          });
        } else {
          await downloadTranslation(id, (progress) => {
            setActiveDownloads((prev) => ({ ...prev, [id]: progress }));
          });
        }
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await refreshStatus();
      } catch (err) {
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : "Download failed",
        }));
      }
    },
    [refreshStatus],
  );

  const handleRemoveTranslation = useCallback(
    async (id: TranslationId) => {
      try {
        await removeTranslation(id);
        await refreshStatus();
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : "Remove failed",
        }));
      }
    },
    [refreshStatus],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--color-surface)] p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Manage Downloads
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mushafs section */}
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Mushafs
          </h3>
          <ul className="space-y-2">
            {MUSHAF_CODES.map((code) => {
              const isDownloaded = downloadedMushafs.includes(code);
              const progress = activeDownloads[code];
              const error = errors[code];
              const isDownloading = !!progress;

              return (
                <li
                  key={code}
                  className="flex items-center justify-between rounded-md border border-[var(--color-muted)]/20 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-text)]">
                      {MUSHAF_DISPLAY_NAMES[code]}
                    </span>
                    {isDownloading && (
                      <ProgressBar progress={progress} />
                    )}
                    {error && (
                      <p className="mt-1 text-xs text-red-500">{error}</p>
                    )}
                  </div>

                  <div className="ml-3 flex items-center gap-2">
                    {isDownloaded && !isDownloading && (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <button
                          type="button"
                          onClick={() => handleRemoveMushaf(code)}
                          className="rounded p-1 text-[var(--color-muted)] hover:text-red-500 transition-colors"
                          aria-label={`Remove ${MUSHAF_DISPLAY_NAMES[code]}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {!isDownloaded && !isDownloading && (
                      <button
                        type="button"
                        onClick={() => handleDownloadMushaf(code)}
                        className="rounded p-1 text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors"
                        aria-label={`Download ${MUSHAF_DISPLAY_NAMES[code]}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    {isDownloading && (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Translations section */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Translations
          </h3>
          <ul className="space-y-2">
            {ALL_TRANSLATION_IDS.map((id) => {
              const isDownloaded = downloadedTranslations.includes(id);
              const progress = activeDownloads[id];
              const error = errors[id];
              const isDownloading = !!progress;

              return (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-muted)]/20 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-text)]">
                      {TRANSLATION_DISPLAY_NAMES[id]}
                    </span>
                    {isDownloading && (
                      <ProgressBar progress={progress} />
                    )}
                    {error && (
                      <p className="mt-1 text-xs text-red-500">{error}</p>
                    )}
                  </div>

                  <div className="ml-3 flex items-center gap-2">
                    {isDownloaded && !isDownloading && (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <button
                          type="button"
                          onClick={() => handleRemoveTranslation(id)}
                          className="rounded p-1 text-[var(--color-muted)] hover:text-red-500 transition-colors"
                          aria-label={`Remove ${TRANSLATION_DISPLAY_NAMES[id]}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {!isDownloaded && !isDownloading && (
                      <button
                        type="button"
                        onClick={() => handleDownloadTranslation(id)}
                        className="rounded p-1 text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors"
                        aria-label={`Download ${TRANSLATION_DISPLAY_NAMES[id]}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    {isDownloading && (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar sub-component
// ---------------------------------------------------------------------------

function ProgressBar({ progress }: { progress: DownloadProgress }) {
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mt-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/20">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        {progress.done} / {progress.total} ({percent}%)
      </p>
    </div>
  );
}
