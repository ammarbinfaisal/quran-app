"use client";

import { useCallback, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  BOOKMARKS_CHANGED_EVENT,
  BOOKMARKS_STORAGE_KEY,
  createBookmarkLabel,
  deleteBookmarkLabel,
  getBookmarksState,
  getDefaultBookmarkState,
  toggleVerseBookmark,
  type BookmarkLabel,
  type BookmarkState,
} from "@/lib/bookmarks";

export function useBookmarks() {
  const [state, setState] = useState<BookmarkState>(() => {
    if (typeof window === "undefined") return getDefaultBookmarkState();
    return getBookmarksState();
  });

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    setState(getBookmarksState());
  }, []);

  useMountEffect(() => {
    const onBookmarksChanged = (event: Event) => {
      setState((event as CustomEvent<BookmarkState>).detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === BOOKMARKS_STORAGE_KEY) setState(getBookmarksState());
    };
    const onPageShow = () => setState(getBookmarksState());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setState(getBookmarksState());
    };

    window.addEventListener(BOOKMARKS_CHANGED_EVENT, onBookmarksChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, onBookmarksChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });

  const createLabel = useCallback((name: string): BookmarkLabel => {
    const label = createBookmarkLabel(name);
    setState(getBookmarksState());
    return label;
  }, []);

  const deleteLabel = useCallback((labelId: string) => {
    const next = deleteBookmarkLabel(labelId);
    setState(next);
    return next;
  }, []);

  const toggleBookmark = useCallback((verseKey: string, labelId: string) => {
    const bookmarked = toggleVerseBookmark(verseKey, labelId);
    setState(getBookmarksState());
    return bookmarked;
  }, []);

  const getVerseLabelIds = useCallback(
    (verseKey: string) =>
      state.bookmarks
        .filter((bookmark) => bookmark.verseKey === verseKey)
        .map((bookmark) => bookmark.labelId),
    [state.bookmarks],
  );

  const isBookmarked = useCallback(
    (verseKey: string, labelId?: string) =>
      state.bookmarks.some(
        (bookmark) =>
          bookmark.verseKey === verseKey &&
          (labelId === undefined || bookmark.labelId === labelId),
      ),
    [state.bookmarks],
  );

  return {
    state,
    refresh,
    createLabel,
    deleteLabel,
    toggleBookmark,
    getVerseLabelIds,
    isBookmarked,
  };
}
