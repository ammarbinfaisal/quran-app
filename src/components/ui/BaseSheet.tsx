"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BaseSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Renders standard title header. Omit to use `header` prop for custom headers. */
  title?: string;
  /** Subtitle below the title */
  subtitle?: ReactNode;
  /** aria-label for the dialog. Falls back to title. */
  ariaLabel?: string;
  /** Custom header ReactNode, replacing the default title/subtitle/close row. Consumer must include their own close button. */
  header?: ReactNode;
  /** z-index layer: 1 = default (overlay z-40, content z-50), 2 = stacked sheet (z-60/z-70). Default 1. */
  layer?: 1 | 2;
  /** Override max-height. Only applied when non-default. CSS default is 60vh. */
  maxHeight?: string;
  /** Render via createPortal to document.body. Use for layer-2 sheets. Default false. */
  portal?: boolean;
}

export function BaseSheet({
  open,
  onClose,
  children,
  title,
  subtitle,
  ariaLabel,
  header,
  layer = 1,
  maxHeight,
  portal = false,
}: BaseSheetProps) {
  if (!open) return null;

  const overlayZ = layer > 1 ? 60 : undefined;
  const contentZ = layer > 1 ? 70 : undefined;

  const overlayStyle = overlayZ !== undefined ? { zIndex: overlayZ } : undefined;
  const contentStyle: React.CSSProperties | undefined =
    contentZ !== undefined
      ? { zIndex: contentZ, ...(maxHeight ? { maxHeight } : {}) }
      : maxHeight
        ? { maxHeight }
        : undefined;

  const node = (
    <>
      <div className="sheet-overlay" style={overlayStyle} onClick={onClose} />
      <div
        className="sheet-content"
        style={contentStyle}
        data-open="true"
        role="dialog"
        aria-label={ariaLabel ?? title}
      >
        <div className="sheet-handle" />

        {header ? (
          header
        ) : title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
              {subtitle && (
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-80 active:scale-[0.97] transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        {children}
      </div>
    </>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(node, document.body);
  }

  return node;
}
