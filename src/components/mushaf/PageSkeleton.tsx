"use client";

const SKELETON_LINE_COUNT = 15;

export function PageSkeleton() {
  return (
    <div className="mushaf-page">
      {Array.from({ length: SKELETON_LINE_COUNT }, (_, i) => (
        <div
          key={i}
          className="h-[0.72em] w-full animate-pulse rounded-sm bg-[color-mix(in_srgb,var(--color-muted)_20%,transparent)]"
        />
      ))}
      <div className="page-number flex-shrink-0 h-4 opacity-0">0</div>
    </div>
  );
}
