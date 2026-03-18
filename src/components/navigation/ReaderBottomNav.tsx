"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Download, Home, Settings } from "lucide-react";
import { ModeToggle } from "@/components/navigation/ModeToggle";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { cn } from "@/lib/utils";

type LabelSize = "sm" | "md";

export interface ReaderBottomNavLabel {
  icon?: ReactNode;
  text: ReactNode;
  ariaLabel?: string;
  onClick: () => void;
  size?: LabelSize;
}

export function ReaderBottomNav({
  visible = true,
  homeHref = "/",
  onHomeClick,
  centerLabel,
  centerExtra,
  centerClassName,
  showModeToggle = true,
  showOfflineIndicator = true,
  showDownloads = true,
  showSettings = true,
  onDownloadsClick,
  onSettingsClick,
}: {
  visible?: boolean;
  homeHref?: string;
  onHomeClick?: () => void;
  centerLabel?: ReaderBottomNavLabel;
  centerExtra?: ReactNode;
  centerClassName?: string;
  showModeToggle?: boolean;
  showOfflineIndicator?: boolean;
  showDownloads?: boolean;
  showSettings?: boolean;
  onDownloadsClick?: () => void;
  onSettingsClick?: () => void;
}) {
  const labelSize = centerLabel?.size ?? "md";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm transition-transform duration-300 ease-in-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-2">
      <Link
        href={homeHref}
        className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
        aria-label="Home"
        onClick={() => onHomeClick?.()}
      >
        <Home className="h-5 w-5" />
      </Link>

      <div className={cn("flex items-center", centerClassName ?? "gap-3")}>
        {centerLabel && (
          <button
            type="button"
            onClick={centerLabel.onClick}
            className={cn(
              "flex items-center rounded-lg text-[var(--color-text)] active:scale-[0.97] active:opacity-80",
              labelSize === "sm"
                ? "gap-1.5 px-2 py-2 text-[11px]"
                : "gap-2 px-4 py-2.5 text-sm",
            )}
            aria-label={centerLabel.ariaLabel}
          >
            {centerLabel.icon}
            <span className="font-medium tabular-nums whitespace-nowrap">
              {centerLabel.text}
            </span>
          </button>
        )}

        {centerExtra}
        {showModeToggle && <ModeToggle />}
      </div>

      <div className="flex items-center">
        {showOfflineIndicator && <OfflineIndicator />}

        {showDownloads && onDownloadsClick && (
          <button
            type="button"
            onClick={onDownloadsClick}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Manage downloads"
          >
            <Download className="h-5 w-5" />
          </button>
        )}

        {showSettings && onSettingsClick && (
          <button
            type="button"
            onClick={onSettingsClick}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>
      </div>
    </nav>
  );
}
