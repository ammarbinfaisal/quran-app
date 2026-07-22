"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Bookmark, Check, Plus, Trash2 } from "lucide-react";
import { BaseSheet } from "@/components/ui/BaseSheet";
import { useBookmarks } from "@/hooks/useBookmarks";
import { DEFAULT_BOOKMARK_LABEL_ID } from "@/lib/bookmarks";
import { showToast } from "@/lib/toast";

export function BookmarkSheet({
  open,
  verseKey,
  onClose,
}: {
  open: boolean;
  verseKey: string;
  onClose: () => void;
}) {
  const { state, createLabel, deleteLabel, toggleBookmark, isBookmarked } =
    useBookmarks();
  const [labelName, setLabelName] = useState("");

  const countsByLabel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bookmark of state.bookmarks) {
      counts.set(bookmark.labelId, (counts.get(bookmark.labelId) ?? 0) + 1);
    }
    return counts;
  }, [state.bookmarks]);

  function handleToggle(labelId: string, labelName: string) {
    try {
      const bookmarked = toggleBookmark(verseKey, labelId);
      showToast(
        bookmarked ? `Saved to ${labelName}` : `Removed from ${labelName}`,
        bookmarked ? "success" : "info",
      );
    } catch {
      showToast("Could not update bookmark.", "error");
    }
  }

  function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = labelName.trim();
    if (!trimmed) {
      showToast("Enter a label name.", "warning");
      return;
    }

    const existing = state.labels.find(
      (label) => label.name.toLowerCase() === trimmed.toLowerCase(),
    );

    try {
      const label = createLabel(trimmed);
      if (!isBookmarked(verseKey, label.id)) {
        toggleBookmark(verseKey, label.id);
      }
      setLabelName("");
      showToast(
        existing ? `Saved under existing label ${label.name}` : `Created ${label.name}`,
        "success",
      );
    } catch {
      showToast("Could not create label.", "error");
    }
  }

  function handleDeleteLabel(labelId: string, name: string) {
    if (labelId === DEFAULT_BOOKMARK_LABEL_ID) return;
    if (!window.confirm(`Delete label "${name}" and its bookmarks?`)) return;
    try {
      deleteLabel(labelId);
      showToast(`Deleted ${name}`, "info");
    } catch {
      showToast("Could not delete label.", "error");
    }
  }

  return (
    <BaseSheet
      open={open}
      onClose={onClose}
      title="Bookmarks"
      subtitle={verseKey}
      ariaLabel={`Bookmarks for ${verseKey}`}
      maxHeight="70vh"
    >
      <form onSubmit={handleCreateLabel} className="mb-4 flex items-center gap-2">
        <input
          value={labelName}
          onChange={(event) => setLabelName(event.target.value)}
          placeholder="New label"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--color-muted)]/20 bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          aria-label="New bookmark label"
        />
        <button
          type="submit"
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] active:scale-[0.97] active:opacity-90"
          aria-label="Create bookmark label"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <div className="space-y-2">
        {state.labels.map((label) => {
          const checked = isBookmarked(verseKey, label.id);
          const count = countsByLabel.get(label.id) ?? 0;
          return (
            <div
              key={label.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-muted)]/15 bg-[var(--color-bg)]/45 p-1.5"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Bookmark this verse under ${label.name}`}
                onClick={() => handleToggle(label.id, label.name)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left active:scale-[0.99] active:opacity-80"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--color-muted)]/30"
                  data-checked={checked}
                >
                  {checked ? (
                    <Check className="h-4 w-4 text-[var(--color-accent)]" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                  {label.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {count}
                </span>
              </button>

              {label.id !== DEFAULT_BOOKMARK_LABEL_ID && (
                <button
                  type="button"
                  onClick={() => handleDeleteLabel(label.id, label.name)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] active:scale-[0.97] active:opacity-80"
                  aria-label={`Delete label ${label.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </BaseSheet>
  );
}
