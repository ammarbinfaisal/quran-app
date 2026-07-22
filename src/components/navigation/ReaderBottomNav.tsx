"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Home, Settings, Share2 } from "lucide-react";
import { ModeToggle } from "@/components/navigation/ModeToggle";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { RecitationButton } from "@/components/recitation/RecitationButton";
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
  showRecitation = true,
  showSettings = true,
  showBack = false,
  onSettingsClick,
  showShare = false,
  onShareClick,
}: {
  visible?: boolean;
  homeHref?: string;
  onHomeClick?: () => void;
  centerLabel?: ReaderBottomNavLabel;
  centerExtra?: ReactNode;
  centerClassName?: string;
  showModeToggle?: boolean;
  showOfflineIndicator?: boolean;
  showRecitation?: boolean;
  showSettings?: boolean;
  showBack?: boolean;
  onSettingsClick?: () => void;
  showShare?: boolean;
  onShareClick?: () => void;
}) {
  const router = useRouter();
  const labelSize = centerLabel?.size ?? "md";

  return (
    <nav
      className="reader-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm transition-transform duration-300 ease-in-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="reader-bottom-nav-inner mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-1 gap-y-1 px-2 py-1 min-[521px]:flex-nowrap lg:max-w-5xl">
        <div
          className="reader-bottom-nav-side reader-bottom-nav-side-start order-2 flex items-center min-[521px]:order-none"
          data-nav-row="actions"
        >
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-[var(--reader-nav-button-size)] w-[var(--reader-nav-back-button-size)] items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Link
            href={homeHref}
            className="flex h-[var(--reader-nav-button-size)] w-[var(--reader-nav-button-size)] items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Home"
            onClick={() => onHomeClick?.()}
          >
            <Home className="h-5 w-5" />
          </Link>
        </div>

        <div
          className={cn(
            "reader-bottom-nav-center order-1 flex min-w-0 flex-1 items-center justify-center min-[521px]:order-none min-[521px]:justify-center max-[520px]:basis-full",
            centerClassName ?? "gap-3",
          )}
          data-nav-row="center"
        >
          {centerLabel && (
            <button
              type="button"
              onClick={centerLabel.onClick}
              className={cn(
                "flex min-w-0 max-w-[var(--reader-nav-label-max)] items-center rounded-lg text-[var(--color-text)] active:scale-[0.97] active:opacity-80",
                labelSize === "sm"
                  ? "h-[var(--reader-nav-control-height)] gap-1 px-1.5 text-[11px]"
                  : "h-[var(--reader-nav-control-height)] gap-1.5 px-2.5 text-sm",
              )}
              aria-label={centerLabel.ariaLabel}
            >
              {centerLabel.icon}
              <span className="min-w-0 truncate font-medium tabular-nums whitespace-nowrap">
                {centerLabel.text}
              </span>
            </button>
          )}

          {centerExtra}
          {showModeToggle && <ModeToggle />}
        </div>

        <div
          className="reader-bottom-nav-side reader-bottom-nav-side-end order-3 flex items-center min-[521px]:order-none"
          data-nav-row="actions"
        >
          {showOfflineIndicator && <OfflineIndicator />}

          {showRecitation && <RecitationButton />}

          {showShare && onShareClick && (
            <button
              type="button"
              onClick={onShareClick}
              className="flex h-[var(--reader-nav-button-size)] w-[var(--reader-nav-button-size)] items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
          )}

          {showSettings && onSettingsClick && (
            <button
              type="button"
              onClick={onSettingsClick}
              className="flex h-[var(--reader-nav-button-size)] w-[var(--reader-nav-button-size)] items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
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
