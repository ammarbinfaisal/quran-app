"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, FileText, MonitorDown, X } from "lucide-react";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { TranslationPicker } from "@/components/settings/TranslationPicker";
import { VerseCopySettings } from "@/components/settings/VerseCopySettings";
import { AyahReciterPicker } from "@/components/settings/AyahReciterPicker";
import { InlineVerseNotesToggle } from "@/components/settings/InlineVerseNotesToggle";
import { FontSizeControl } from "@/components/settings/FontSizeControl";
import { DataUsageModePicker } from "@/components/settings/DataUsageModePicker";
import { DataManagerSection } from "@/components/settings/DataManagerSection";
import { DownloadsSection } from "@/components/settings/DownloadsSection";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useMountEffect } from "@/hooks/useMountEffect";

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });

  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openRef.current && e.key === "Escape") {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const { canInstall, install } = usePwaInstall();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-2xl bg-[var(--color-surface)] shadow-lg" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-muted)]/20">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto overscroll-contain px-4 py-4 space-y-5">
          <ThemePicker />
          <TranslationPicker />
          <AyahReciterPicker />
          <VerseCopySettings />
          <InlineVerseNotesToggle />
          <FontSizeControl />
          <DataUsageModePicker />
          <DownloadsSection />
          <DataManagerSection />

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Help
            </h3>
            <Link
              href="/docs"
              onClick={onClose}
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
                  <FileText className="h-4 w-4 text-[var(--color-accent)]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--color-text)]">
                    Docs
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
                    Features, icons, data sources, and design decisions.
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
            </Link>
          </section>
        </div>

        {canInstall && (
          <div className="px-4 py-3 border-t border-[var(--color-muted)]/20">
            <button
              type="button"
              onClick={install}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white active:opacity-80 active:scale-[0.98] transition"
            >
              <MonitorDown className="h-4 w-4" />
              Install
            </button>
          </div>
        )}
      </div>
    </>
  );
}
