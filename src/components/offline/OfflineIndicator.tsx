"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CloudOff } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { MUSHAF_DISPLAY_NAMES } from "@/lib/types";
import { renderTranslationName } from "@/lib/translationDisplay";
import { useMountEffect } from "@/hooks/useMountEffect";

export function OfflineIndicator() {
  const { status } = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useLayoutEffect(() => {
    openRef.current = open;
  });

  useMountEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!openRef.current || !containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  });

  // Only show when offline
  if (!status || status.online) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[var(--reader-nav-button-size,2.75rem)] w-[var(--reader-nav-button-size,2.75rem)] items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Offline status"
      >
        <CloudOff className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed right-4 top-14 z-50 w-72 rounded-lg bg-[var(--color-surface)] p-4 shadow-lg">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">
            You&apos;re offline
          </p>

          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
              Downloaded Mushafs
            </p>
            {status.downloadedMushafs.length > 0 ? (
              <ul className="space-y-0.5">
                {status.downloadedMushafs.map((code) => (
                  <li key={code} className="text-sm text-[var(--color-text)]">
                    {MUSHAF_DISPLAY_NAMES[code]}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">None</p>
            )}
          </div>

          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
              Downloaded Translations
            </p>
            {status.downloadedTranslations.length > 0 ? (
              <ul className="space-y-0.5">
                {status.downloadedTranslations.map((id) => (
                  <li key={id} className="text-sm text-[var(--color-text)]">
                    {renderTranslationName(id)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">None</p>
            )}
          </div>

          <p className="text-xs text-[var(--color-muted)]">
            Some pages may be available from cache.
          </p>
        </div>
      )}
    </div>
  );
}
