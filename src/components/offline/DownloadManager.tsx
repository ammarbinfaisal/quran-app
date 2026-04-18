"use client";

import { useState, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { DownloadRow } from "@/components/download/DownloadRow";
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
  const [downloadedRecitations, setDownloadedRecitations] = useState<AyahReciterId[]>([]);

  // Track active downloads by key (mushaf code or translation id)
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
  // Recitation handlers
  // -----------------------------------------------------------------------

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

          {/* Recitation audio section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Recitation Audio
            </h3>
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
          </section>
        </div>
      </div>
    </>
  );
}

