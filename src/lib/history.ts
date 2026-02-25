import { HISTORY_MAX_ENTRIES } from "./constants";
import type { HistoryEntry } from "./types";

const STORAGE_KEY = "quran-reading-history";

export function getReadingHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Update reading history for a chapter. If the chapter already exists in
 * history, update its verse/page/timestamp. Keep only the last N chapters.
 */
export function updateReadingHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const history = getReadingHistory();
  const idx = history.findIndex((h) => h.chapterId === entry.chapterId);
  if (idx >= 0) {
    history.splice(idx, 1);
  }
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > HISTORY_MAX_ENTRIES) {
    history.length = HISTORY_MAX_ENTRIES;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(
    new CustomEvent<HistoryEntry[]>("reading-history-changed", {
      detail: history,
    }),
  );
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent<HistoryEntry[]>("reading-history-changed", { detail: [] }),
  );
}
