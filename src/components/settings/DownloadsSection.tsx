"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { Download, Trash2, Check, Loader2, ChevronRight } from "lucide-react";
import {
  type MushafCode,
  type TranslationId,
  type AyahReciterId,
  type DownloadProgress,
  MUSHAF_CODES,
  MUSHAF_DISPLAY_NAMES,
  TRANSLATION_DISPLAY_NAMES,
  AYAH_RECITER_DISPLAY_NAMES,
  SUPPORTED_AYAH_RECITERS,
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
  downloadRecitation,
  removeRecitation,
} from "@/lib/offline/download";
import {
  getDownloadedMushafs,
  getDownloadedTranslations,
  isMorphologyDownloaded,
  isLemmasDownloaded,
  getDownloadedRecitations,
} from "@/lib/offline/status";

const USER_TRANSLATION_IDS: Exclude<TranslationId, "abu-iyaad">[] = [
  "saheeh",
  "hilali-khan",
];

export function DownloadsSection() {
  const [expanded, setExpanded] = useState(false);
  const [downloadedMushafs, setDownloadedMushafs] = useState<MushafCode[]>([]);
  const [downloadedTranslations, setDownloadedTranslations] = useState<TranslationId[]>([]);
  const [morphologyDownloaded, setMorphologyDownloaded] = useState(false);
  const [lemmasDownloaded, setLemmasDownloaded] = useState(false);
  const [downloadedRecitations, setDownloadedRecitations] = useState<AyahReciterId[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadProgress>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshStatus = useCallback(async () => {
    try {
      const [mushafs, translations, morph, lem, recitations] = await Promise.all([
        getDownloadedMushafs(),
        getDownloadedTranslations(),
        isMorphologyDownloaded(),
        isLemmasDownloaded(),
        getDownloadedRecitations(),
      ]);
      setDownloadedMushafs(mushafs);
      setDownloadedTranslations(translations);
      setMorphologyDownloaded(morph);
      setLemmasDownloaded(lem);
      setDownloadedRecitations(recitations);
    } catch {
      // IndexedDB may be unavailable
    }
  }, []);

  // Refresh status when section expands (adjust-state-during-render)
  const prevExpandedRef = useRef(expanded);
  if (expanded && !prevExpandedRef.current) {
    refreshStatus();
  }
  prevExpandedRef.current = expanded;

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

  const morphLexiconDownloaded = morphologyDownloaded && lemmasDownloaded;
  const morphLexiconKey = "morph-lexicon";

  const handleDownloadMorphLexicon = useCallback(async () => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[morphLexiconKey];
      return next;
    });

    try {
      await downloadMorphology((progress) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [morphLexiconKey]: { ...progress, label: "Downloading morphology data" },
        }));
      });

      await downloadLemmas((progress) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [morphLexiconKey]: { ...progress, label: "Downloading lemma data" },
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

  const handleDownloadRecitation = useCallback(
    async (id: AyahReciterId) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`recitation:${id}`];
        return next;
      });

      try {
        await downloadRecitation(id, (progress) => {
          setActiveDownloads((prev) => ({ ...prev, [`recitation:${id}`]: progress }));
        });
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[`recitation:${id}`];
          return next;
        });
        await refreshStatus();
      } catch (err) {
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[`recitation:${id}`];
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [`recitation:${id}`]: err instanceof Error ? err.message : "Download failed",
        }));
      }
    },
    [refreshStatus],
  );

  const handleRemoveRecitation = useCallback(
    async (id: AyahReciterId) => {
      try {
        await removeRecitation(id);
        await refreshStatus();
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [`recitation:${id}`]: err instanceof Error ? err.message : "Remove failed",
        }));
      }
    },
    [refreshStatus],
  );

  const downloadCount =
    downloadedMushafs.length +
    downloadedTranslations.filter((t) => t !== "abu-iyaad").length +
    (morphLexiconDownloaded ? 1 : 0) +
    downloadedRecitations.length;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Offline Downloads
      </h3>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-12 w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors"
        style={{
          borderColor: "rgba(0,0,0,0.08)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-surface)" }}
          >
            <Download className="h-4 w-4 text-[var(--color-accent)]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--color-text)]">
              Manage Downloads
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
              {downloadCount > 0
                ? `${downloadCount} item${downloadCount === 1 ? "" : "s"} saved for offline`
                : "Save content for offline reading"}
            </span>
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-bg)] p-3">
          {/* Mushaf section */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Mushaf
            </h4>
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
          </div>

          {/* Translations section */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Translations
            </h4>
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
          </div>

          {/* Morphology & Lexicon section */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Morphology & Lexicon
            </h4>
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
          </div>

          {/* Recitation audio section */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Recitation Audio
            </h4>
            <ul className="space-y-2">
              {SUPPORTED_AYAH_RECITERS.map((id) => (
                <DownloadRow
                  key={id}
                  label={AYAH_RECITER_DISPLAY_NAMES[id]}
                  isDownloaded={downloadedRecitations.includes(id)}
                  progress={activeDownloads[`recitation:${id}`]}
                  error={errors[`recitation:${id}`]}
                  onDownload={() => handleDownloadRecitation(id)}
                  onRemove={() => handleRemoveRecitation(id)}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

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
    <li className="flex items-center justify-between rounded-lg border border-[var(--color-muted)]/20 px-3 py-2.5 min-h-11">
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-red-500 active:opacity-80 transition"
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-accent)] active:opacity-80 transition"
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
