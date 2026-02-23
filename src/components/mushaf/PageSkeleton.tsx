"use client";

const SKELETON_LINE_COUNT = 15;

export function PageSkeleton() {
  return (
    <div className="mushaf-page">
      {Array.from({ length: SKELETON_LINE_COUNT }, (_, i) => (
        <div
          key={i}
          className="animate-pulse bg-muted/30 rounded h-6 w-full"
        />
      ))}
    </div>
  );
}
