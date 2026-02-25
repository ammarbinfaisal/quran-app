import { Suspense } from "react";
import { SearchViewer } from "@/components/search/SearchViewer";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg)] text-sm text-[var(--color-muted)]">
          Loading…
        </div>
      }
    >
      <SearchViewer />
    </Suspense>
  );
}
