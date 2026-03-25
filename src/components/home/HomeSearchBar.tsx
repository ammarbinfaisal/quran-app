"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const NAVIGATE_DEBOUNCE_MS = 1200;

export function HomeSearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const timeoutRef = useRef<number | null>(null);

  const trimmed = value.trim();
  const hasText = trimmed.length > 0;

  function handleChange(newValue: string) {
    setValue(newValue);
    const t = newValue.trim();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (t.length > 0) {
      timeoutRef.current = window.setTimeout(() => {
        router.push(`/search?q=${encodeURIComponent(t)}`);
      }, NAVIGATE_DEBOUNCE_MS);
    }
  }

  return (
    <div className="px-4">
      <label className="relative block">
        <span className="sr-only">Search Quran</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (!trimmed) return;
            router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
          placeholder="Search Quran…"
          className="w-full rounded-lg bg-[var(--color-bg)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-muted)]/20 focus:ring-[var(--color-accent)]/40"
          autoComplete="off"
          inputMode="search"
        />
        {hasText && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-[var(--color-muted)] active:bg-black/5"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>
    </div>
  );
}
