"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  ariaLabel?: string;
  header?: ReactNode;
  layer?: 1 | 2;
  maxHeight?: string;
  portal?: boolean;
  contentClassName?: string;
  overlayClassName?: string;
  handleClassName?: string;
  /** Extra inline styles for the content wrapper. */
  contentStyle?: React.CSSProperties;
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
  contentClassName,
  overlayClassName,
  handleClassName,
  contentStyle,
}: BaseSheetProps) {
  if (!open) return null;

  const overlayZ = layer > 1 ? 60 : undefined;
  const contentZ = layer > 1 ? 70 : undefined;

  const overlayStyle = overlayZ !== undefined ? { zIndex: overlayZ } : undefined;
  const resolvedContentStyle: React.CSSProperties | undefined = {
    ...(contentZ !== undefined ? { zIndex: contentZ } : {}),
    ...(maxHeight ? { maxHeight } : {}),
    ...contentStyle,
  };
  const hasContentStyle = Object.keys(resolvedContentStyle).length > 0;

  const node = (
    <>
      <div
        className={cn("sheet-overlay", overlayClassName)}
        style={overlayStyle}
        onClick={onClose}
      />
      <div
        className={cn("sheet-content", contentClassName)}
        style={hasContentStyle ? resolvedContentStyle : undefined}
        data-open="true"
        role="dialog"
        aria-label={ariaLabel ?? title}
      >
        <div className={cn("sheet-handle", handleClassName)} />

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
