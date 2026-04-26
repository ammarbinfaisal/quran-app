"use client";

const SKELETON_LINE_COUNT = 15;

export function PageSkeleton() {
  return (
    <div className="mushaf-page relative flex flex-col justify-between">
      {Array.from({ length: SKELETON_LINE_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-center shrink-0 h-[calc(var(--mushaf-page-width)*0.108)]"
        >
          <span
            className="block h-[0.72em] w-full animate-pulse rounded-sm bg-[color-mix(in_srgb,var(--color-muted)_20%,transparent)]"
          />
        </div>
      ))}
      <div className="page-number flex-shrink-0 h-4 opacity-0">0</div>
    </div>
  );
}
