"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { ReadingModePicker } from "@/components/settings/ReadingModePicker";
import { MushafPicker } from "@/components/settings/MushafPicker";
import { TranslationPicker } from "@/components/settings/TranslationPicker";
import { FontSizeControl } from "@/components/settings/FontSizeControl";

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-2xl bg-[var(--color-surface)] shadow-lg">
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-muted)]/20">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto overscroll-contain px-4 py-4 space-y-5">
          <ThemePicker />
          <ReadingModePicker />
          <MushafPicker />
          <TranslationPicker />
          <FontSizeControl />
        </div>
      </div>
    </>
  );
}
