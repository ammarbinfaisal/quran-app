"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { Download, Trash2, Check, Loader2, X } from "lucide-react";
import {
  type MushafCode,
  type TranslationId,
  type DownloadProgress,
  MUSHAF_CODES,
  MUSHAF_DISPLAY_NAMES,
  TRANSLATION_DISPLAY_NAMES,
} from "@/lib/types";
import { renderTranslationName } from "@/lib/translationDisplay";
import {
  downloadMushaf,
  removeMushaf,
  downloadTranslation,
  removeTranslation,
  downloadMorphology,
  removeMorphology,
  downloadLemmas,
  removeLemmas,
} from "@/lib/offline/download";
import {
  getDownloadedMushafs,
  getDownloadedTranslations,
  isMorphologyDownloaded,
  isLemmasDownloaded,
} from "@/lib/offline/status";

/** Only these two are user-choosable. */
const USER_TRANSLATION_IDS: Exclude<TranslationId, "abu-iyaad">[] = [
  "saheeh",
  "hilali-khan",
];

interface DownloadManagerProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadManager({ open, onClose }: DownloadManagerProps) {
  const [downloadedMushafs, setDownloadedMushafs] = useState<MushafCode[]>([]);
  const [downloadedTranslations, setDownloadedTranslations] = useState<TranslationId[]>([]);
  const [morphologyDownloaded, setMorphologyDownloaded] = useState(false);
  const [lemmasDownloaded, setLemmasDownloaded] = useState(false);

  // Track active downloads by key (mushaf code or translation id)
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadProgress>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshStatus = useCallback(async () => {
    try {
      const [mushafs, translations, morph, lem] = await Promise.all([
        getDownloadedMushafs(),
        getDownloadedTranslations(),
        isMorphologyDownloaded(),
        isLemmasDownloaded(),
      ]);
      setDownloadedMushafs(mushafs);
      setDownloadedTranslations(translations);
      setMorphologyDownloaded(morph);
      setLemmasDownloaded(lem);
    } catch {
      // IndexedDB may be unavailable
    }
  }, []);

  // Refresh download status when the sheet opens (adjust-state-during-render)
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    refreshStatus();
  }
  prevOpenRef.current = open;

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
    async (id: Exclude<TranslationId, "abu-iyaad">) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      try {
        await downloadTranslation(id, (progress) => {
          setActiveDownloads((prev) => ({ ...prev, [id]: progress }));
        });
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
    async (id: Exclude<TranslationId, "abu-iyaad">) => {
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
  // Morphology & Lexicon handlers
  // -----------------------------------------------------------------------

  const morphLexiconDownloaded = morphologyDownloaded && lemmasDownloaded;
  const morphLexiconKey = "morph-lexicon";

  const handleDownloadMorphLexicon = useCallback(async () => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[morphLexiconKey];
      return next;
    });

    try {
      // Download morphology
      await downloadMorphology((progress) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [morphLexiconKey]: {
            ...progress,
            label: "Downloading morphology data",
          },
        }));
      });

      // Download lemmas
      await downloadLemmas((progress) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [morphLexiconKey]: {
            ...progress,
            label: "Downloading lemma data",
          },
        }));
      });

      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[morphLexiconKey];
        return next;
      });
      await refreshStatus();
    } catch (err) {
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[morphLexiconKey];
        return next;
      });
      setErrors((prev) => ({
        ...prev,
        [morphLexiconKey]: err instanceof Error ? err.message : "Download failed",
      }));
    }
  }, [refreshStatus]);

  const handleRemoveMorphLexicon = useCallback(async () => {
    try {
      await removeMorphology();
      await removeLemmas();
      await refreshStatus();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [morphLexiconKey]: err instanceof Error ? err.message : "Remove failed",
      }));
    }
  }, [refreshStatus]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-2xl bg-[var(--color-surface)] shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Handle + Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-muted)]/20">
          <div className="sheet-handle mx-0" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Manage Downloads
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto overscroll-contain px-4 py-4 space-y-6">
          {/* Mushaf section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Mushaf
            </h3>
            <ul className="space-y-2">
              {MUSHAF_CODES.map((code) => (
                <DownloadRow
                  key={code}
                  label={MUSHAF_DISPLAY_NAMES[code]}
                  isDownloaded={downloadedMushafs.includes(code)}
                  progress={activeDownloads[code]}
                  error={errors[code]}
                  onDownload={() => handleDownloadMushaf(code)}
                  onRemove={() => handleRemoveMushaf(code)}
                />
              ))}
            </ul>
          </section>

          {/* Translations section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Translations
            </h3>
            <ul className="space-y-2">
              {USER_TRANSLATION_IDS.map((id) => (
                <DownloadRow
                  key={id}
                  label={TRANSLATION_DISPLAY_NAMES[id]}
                  displayLabel={renderTranslationName(id)}
                  isDownloaded={downloadedTranslations.includes(id)}
                  progress={activeDownloads[id]}
                  error={errors[id]}
                  onDownload={() => handleDownloadTranslation(id)}
                  onRemove={() => handleRemoveTranslation(id)}
                />
              ))}
            </ul>
          </section>

          {/* Morphology & Lexicon section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Morphology & Lexicon
            </h3>
            <ul className="space-y-2">
              <DownloadRow
                label="Morphology + Lemma Data"
                isDownloaded={morphLexiconDownloaded}
                progress={activeDownloads[morphLexiconKey]}
                error={errors[morphLexiconKey]}
                onDownload={handleDownloadMorphLexicon}
                onRemove={handleRemoveMorphLexicon}
              />
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reusable download row
// ---------------------------------------------------------------------------

function DownloadRow({
  label,
  displayLabel,
  isDownloaded,
  progress,
  error,
  onDownload,
  onRemove,
}: {
  label: string;
  displayLabel?: ReactNode;
  isDownloaded: boolean;
  progress?: DownloadProgress;
  error?: string;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const isDownloading = !!progress;

  return (
    <li className="flex items-center justify-between rounded-lg border border-[var(--color-muted)]/20 px-3 py-3 min-h-12">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--color-text)]">{displayLabel ?? label}</span>
        {isDownloading && progress && <ProgressBar progress={progress} />}
        {error && (
          <p className="mt-1 text-xs text-red-500">
            Download failed. Tap the download button to resume.
          </p>
        )}
      </div>

      <div className="ml-3 flex items-center gap-1">
        {isDownloaded && !isDownloading && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <button
              type="button"
              onClick={onRemove}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-red-500 active:opacity-80 transition"
              aria-label={`Remove ${label}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        {!isDownloaded && !isDownloading && (
          <button
            type="button"
            onClick={onDownload}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-accent)] active:opacity-80 transition"
            aria-label={`Download ${label}`}
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
