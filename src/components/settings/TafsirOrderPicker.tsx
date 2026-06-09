"use client";

import { useCallback } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { TAFSIR_DISPLAY_NAMES, TAFSIR_ARABIC_NAMES } from "@/lib/types";
import { normalizeTafsirOrder } from "@/lib/tafsir/order";

export function TafsirOrderPicker() {
  const { prefs, setPref } = usePreferences();
  const order = normalizeTafsirOrder(prefs.tafsirOrder);

  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = [...order];
      const target = index + direction;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setPref("tafsirOrder", next);
    },
    [order, setPref],
  );

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Tafsir Order
      </h3>
      <div className="grid grid-cols-1 gap-1.5">
        {order.map((id, index) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              borderColor: "rgba(0,0,0,0.08)",
              backgroundColor: "var(--color-bg)",
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="font-arabic text-sm text-[var(--color-text)]"
                dir="rtl"
              >
                {TAFSIR_ARABIC_NAMES[id]}
              </span>
              <span className="text-xs text-[var(--color-muted)]">
                {TAFSIR_DISPLAY_NAMES[id]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move ${TAFSIR_DISPLAY_NAMES[id]} up`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-20 disabled:pointer-events-none transition"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${TAFSIR_DISPLAY_NAMES[id]} down`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] active:scale-95 disabled:opacity-20 disabled:pointer-events-none transition"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
