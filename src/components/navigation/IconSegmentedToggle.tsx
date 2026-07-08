"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IconSegmentedOption<T extends string> {
  value: T;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface IconSegmentedToggleProps<T extends string> {
  options: ReadonlyArray<IconSegmentedOption<T>>;
  value: T;
  pendingValue?: T | null;
  ariaLabel: string;
  onSelect: (value: T) => void;
  itemWidthPx?: number;
  itemWidth?: string;
  iconClassName?: string;
  disabled?: boolean;
  className?: string;
}

export function IconSegmentedToggle<T extends string>({
  options,
  value,
  pendingValue = null,
  ariaLabel,
  onSelect,
  itemWidthPx = 28,
  itemWidth,
  iconClassName = "h-3.5 w-3.5",
  disabled = false,
  className,
}: IconSegmentedToggleProps<T>) {
  const visualActive = pendingValue ?? value;
  const activeIndex = options.findIndex((option) => option.value === visualActive);
  const containerWidth = itemWidth
    ? `calc(${itemWidth} * ${options.length} + 4px)`
    : `${itemWidthPx * options.length + 4}px`;

  return (
    <div
      className={cn(
        "relative flex h-[var(--reader-nav-segment-height,2rem)] items-center rounded-full bg-[var(--color-surface)] p-[2px] shadow-inner",
        className,
      )}
      style={{ width: containerWidth }}
      aria-label={ariaLabel}
    >
      <div
        className="absolute left-[2px] top-[2px] bottom-[2px] rounded-full bg-[var(--color-bg)] shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${Math.max(0, activeIndex) * 100}%)`,
        }}
      />

      {options.map(({ value: optionValue, label, Icon }, index) => {
        const selected = activeIndex === index;
        const isPending = pendingValue === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onSelect(optionValue)}
            disabled={disabled || pendingValue !== null}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center transition-colors duration-300",
              selected ? "text-[var(--color-text)]" : "text-[var(--color-muted)]",
            )}
            aria-label={`${ariaLabel}: ${label}`}
            aria-pressed={selected}
          >
            <span className="relative flex items-center justify-center">
              <Icon className={cn(iconClassName, isPending && "opacity-35")} />
              {isPending && (
                <Loader2 className={cn("absolute animate-spin", iconClassName)} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
