export interface BookmarkLabel {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface VerseBookmark {
  id: string;
  verseKey: string;
  labelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkState {
  labels: BookmarkLabel[];
  bookmarks: VerseBookmark[];
}

export const BOOKMARKS_STORAGE_KEY = "quran-bookmarks:v1";
export const BOOKMARKS_CHANGED_EVENT = "bookmarks-changed";
export const DEFAULT_BOOKMARK_LABEL_ID = "default";
export const DEFAULT_BOOKMARK_LABEL_NAME = "Saved";

function now() {
  return Date.now();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultLabel(timestamp = now()): BookmarkLabel {
  return {
    id: DEFAULT_BOOKMARK_LABEL_ID,
    name: DEFAULT_BOOKMARK_LABEL_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getDefaultBookmarkState(): BookmarkState {
  return {
    labels: [defaultLabel()],
    bookmarks: [],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeBookmarkState(value: unknown): BookmarkState {
  const timestamp = now();
  const rawLabels = isPlainObject(value) && Array.isArray(value.labels) ? value.labels : [];
  const rawBookmarks =
    isPlainObject(value) && Array.isArray(value.bookmarks) ? value.bookmarks : [];

  const labelsById = new Map<string, BookmarkLabel>();
  for (const rawLabel of rawLabels) {
    if (!isPlainObject(rawLabel)) continue;
    const id = typeof rawLabel.id === "string" ? rawLabel.id.trim() : "";
    const name = typeof rawLabel.name === "string" ? rawLabel.name.trim() : "";
    if (!id || !name || labelsById.has(id)) continue;
    labelsById.set(id, {
      id,
      name,
      createdAt: normalizeTimestamp(rawLabel.createdAt, timestamp),
      updatedAt: normalizeTimestamp(rawLabel.updatedAt, timestamp),
    });
  }

  const existingDefault = labelsById.get(DEFAULT_BOOKMARK_LABEL_ID);
  labelsById.set(DEFAULT_BOOKMARK_LABEL_ID, {
    ...defaultLabel(existingDefault?.createdAt ?? timestamp),
    updatedAt: existingDefault?.updatedAt ?? timestamp,
  });

  const labels = Array.from(labelsById.values()).sort((a, b) => {
    if (a.id === DEFAULT_BOOKMARK_LABEL_ID) return -1;
    if (b.id === DEFAULT_BOOKMARK_LABEL_ID) return 1;
    return a.createdAt - b.createdAt;
  });
  const labelIds = new Set(labels.map((label) => label.id));

  const bookmarkKeys = new Set<string>();
  const bookmarks: VerseBookmark[] = [];
  for (const rawBookmark of rawBookmarks) {
    if (!isPlainObject(rawBookmark)) continue;
    const verseKey = typeof rawBookmark.verseKey === "string" ? rawBookmark.verseKey.trim() : "";
    const labelId = typeof rawBookmark.labelId === "string" ? rawBookmark.labelId.trim() : "";
    if (!verseKey || !labelIds.has(labelId)) continue;
    const key = `${verseKey}|${labelId}`;
    if (bookmarkKeys.has(key)) continue;
    bookmarkKeys.add(key);
    bookmarks.push({
      id:
        typeof rawBookmark.id === "string" && rawBookmark.id
          ? rawBookmark.id
          : createId("bookmark"),
      verseKey,
      labelId,
      createdAt: normalizeTimestamp(rawBookmark.createdAt, timestamp),
      updatedAt: normalizeTimestamp(rawBookmark.updatedAt, timestamp),
    });
  }

  return { labels, bookmarks };
}

export function getBookmarksState(): BookmarkState {
  if (typeof window === "undefined") return getDefaultBookmarkState();
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    return normalizeBookmarkState(raw ? JSON.parse(raw) : null);
  } catch {
    return getDefaultBookmarkState();
  }
}

export function setBookmarksState(next: BookmarkState): BookmarkState {
  const normalized = normalizeBookmarkState(next);
  if (typeof window === "undefined") return normalized;
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent<BookmarkState>(BOOKMARKS_CHANGED_EVENT, {
        detail: normalized,
      }),
    );
  } catch {
    // Keep callers resilient when storage is unavailable.
  }
  return normalized;
}

export function createBookmarkLabel(name: string): BookmarkLabel {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Bookmark label name is required.");

  const state = getBookmarksState();
  const existing = state.labels.find(
    (label) => label.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;

  const timestamp = now();
  const label: BookmarkLabel = {
    id: createId("label"),
    name: trimmed,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  setBookmarksState({ ...state, labels: [...state.labels, label] });
  return label;
}

export function deleteBookmarkLabel(labelId: string): BookmarkState {
  if (labelId === DEFAULT_BOOKMARK_LABEL_ID) return getBookmarksState();
  const state = getBookmarksState();
  return setBookmarksState({
    labels: state.labels.filter((label) => label.id !== labelId),
    bookmarks: state.bookmarks.filter((bookmark) => bookmark.labelId !== labelId),
  });
}

export function toggleVerseBookmark(verseKey: string, labelId: string): boolean {
  const state = getBookmarksState();
  if (!state.labels.some((label) => label.id === labelId)) return false;

  const existing = state.bookmarks.find(
    (bookmark) => bookmark.verseKey === verseKey && bookmark.labelId === labelId,
  );
  if (existing) {
    setBookmarksState({
      ...state,
      bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== existing.id),
    });
    return false;
  }

  const timestamp = now();
  setBookmarksState({
    ...state,
    bookmarks: [
      ...state.bookmarks,
      {
        id: createId("bookmark"),
        verseKey,
        labelId,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  });
  return true;
}

export function getVerseLabelIds(verseKey: string): string[] {
  return getBookmarksState()
    .bookmarks.filter((bookmark) => bookmark.verseKey === verseKey)
    .map((bookmark) => bookmark.labelId);
}

export function isVerseBookmarked(verseKey: string, labelId?: string): boolean {
  return getBookmarksState().bookmarks.some(
    (bookmark) =>
      bookmark.verseKey === verseKey &&
      (labelId === undefined || bookmark.labelId === labelId),
  );
}
