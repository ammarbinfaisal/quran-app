"use client";

import { useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, type LucideIcon } from "lucide-react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { TOAST_EVENT, type ToastEventDetail, type ToastVariant } from "@/lib/toast";

interface ToastItem extends ToastEventDetail {
  id: number;
}

const TOAST_DURATION_MS = 3200;

const VARIANT_ICON: Record<ToastVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  info: "var(--color-accent)",
  success: "var(--color-accent)",
  warning: "#d97706",
  error: "#dc2626",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  useMountEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail) return;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, ...detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  });

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-sm flex-col items-center gap-2 px-4"
      style={{
        bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
      }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = VARIANT_ICON[toast.variant];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-[var(--color-muted)]/20 bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] shadow-lg"
            style={{ animation: "fade-in 200ms ease-out" }}
          >
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: VARIANT_ACCENT[toast.variant] }}
            />
            <span className="leading-snug">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
