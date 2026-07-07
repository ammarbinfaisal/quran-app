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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-muted)]/15 bg-[var(--color-bg)]/95 backdrop-blur-sm transition-transform duration-300 ease-in-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-2 lg:max-w-5xl">
      <div className="flex items-center">
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-12 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <Link
          href={homeHref}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
          aria-label="Home"
          onClick={() => onHomeClick?.()}
        >
          <Home className="h-5 w-5" />
        </Link>
      </div>

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

        {showRecitation && <RecitationButton />}

        {showShare && onShareClick && (
          <button
            type="button"
            onClick={onShareClick}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-[var(--color-muted)] active:scale-95 active:opacity-80"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
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
