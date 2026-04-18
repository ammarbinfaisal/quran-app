"use client";

import type { ReactNode } from "react";
import { Download, Trash2, Check, Loader2 } from "lucide-react";
import type { DownloadProgress } from "@/lib/types";

export function DownloadRow({
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

export function ProgressBar({ progress }: { progress: DownloadProgress }) {
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
