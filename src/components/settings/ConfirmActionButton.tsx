"use client";

import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmActionButtonProps {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}

export function ConfirmActionButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  busyLabel,
  onConfirm,
  disabled = false,
  tone = "neutral",
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled || busy}
          className={cn(
            "min-h-12 w-full rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{
            borderColor:
              tone === "danger" ? "color-mix(in srgb, #b91c1c 22%, transparent)" : "rgba(0,0,0,0.08)",
            backgroundColor: "var(--color-bg)",
            color: tone === "danger" ? "#b91c1c" : "var(--color-text)",
          }}
        >
          {busy ? busyLabel : triggerLabel}
        </button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[70] w-[min(calc(100vw-2rem),28rem)]",
            "-translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-lg",
            "focus:outline-none",
          )}
          style={{
            borderColor: "var(--color-muted)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <AlertDialog.Title className="text-balance text-base font-semibold text-[var(--color-text)]">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted)]">
            {description}
          </AlertDialog.Description>

          <div className="mt-5 flex items-center justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-[var(--color-muted)]/20 px-4 text-sm font-medium text-[var(--color-text)]"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className={cn(
                "min-h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60",
                tone === "danger" ? "bg-red-700" : "bg-[var(--color-accent)]",
              )}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
