/**
 * Finds the first element with a `data-verse-key` attribute that is at or below
 * the top of the given scroll container.
 */
export function getFirstFullyVisibleVerse(scrollContainer: HTMLElement): string | null {
  const blocks = scrollContainer.querySelectorAll<HTMLElement>("[data-verse-key]");
  const containerRect = scrollContainer.getBoundingClientRect();

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    // Skip blocks that are completely above the viewport
    // "fully inside" = top >= container top
    // A small buffer (-1) handles sub-pixel rendering issues.
    if (rect.top >= containerRect.top - 1) {
      return block.dataset.verseKey ?? null;
    }
  }
  return null;
}

/**
 * Finds the first page marker at or below the top of the given scroll container.
 */
export function getFirstFullyVisiblePage(scrollContainer: HTMLElement): number | null {
  const blocks = scrollContainer.querySelectorAll<HTMLElement>("[data-scroll-page]");
  const containerRect = scrollContainer.getBoundingClientRect();

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (rect.top >= containerRect.top - 1) {
      const page = Number.parseInt(block.dataset.scrollPage ?? "", 10);
      if (Number.isFinite(page)) return page;
    }
  }
  return null;
}
