"use client";

import { useEffect } from "react";
import { X, MonitorDown } from "lucide-react";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { TranslationPicker } from "@/components/settings/TranslationPicker";
import { VerseCopySettings } from "@/components/settings/VerseCopySettings";
import { InlineVerseNotesToggle } from "@/components/settings/InlineVerseNotesToggle";
import { FontSizeControl } from "@/components/settings/FontSizeControl";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
          <VerseCopySettings />
          <InlineVerseNotesToggle />
          <FontSizeControl />
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
