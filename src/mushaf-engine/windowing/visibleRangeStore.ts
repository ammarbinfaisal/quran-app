export type VisibleRange = {
  startIndex: number;
  endIndex: number;
  firstVisibleIndex: number;
  lastVisibleIndex: number;
  direction: "up" | "down";
};

type Listener = () => void;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sameRange(a: VisibleRange, b: VisibleRange) {
  return (
    a.startIndex === b.startIndex &&
    a.endIndex === b.endIndex &&
    a.firstVisibleIndex === b.firstVisibleIndex &&
    a.lastVisibleIndex === b.lastVisibleIndex &&
    a.direction === b.direction
  );
}

function computeRange(input: {
  scrollTop: number;
  viewportHeight: number;
  pageBlockHeight: number;
  totalCount: number;
  bufferBehind: number;
  bufferAhead: number;
  prevScrollTop: number;
}): VisibleRange {
  const {
    scrollTop,
    viewportHeight,
    pageBlockHeight,
    totalCount,
    bufferBehind,
    bufferAhead,
    prevScrollTop,
  } = input;

  const safeBlock = Math.max(1, pageBlockHeight);
  const firstVisible = clamp(Math.floor(scrollTop / safeBlock), 0, totalCount - 1);
  const lastVisible = clamp(
    Math.floor((scrollTop + Math.max(0, viewportHeight - 1)) / safeBlock),
    0,
    totalCount - 1
  );

  const startIndex = clamp(firstVisible - bufferBehind, 0, totalCount - 1);
  const endIndex = clamp(lastVisible + bufferAhead, 0, totalCount - 1);

  return {
    startIndex,
    endIndex,
    firstVisibleIndex: firstVisible,
    lastVisibleIndex: lastVisible,
    direction: scrollTop >= prevScrollTop ? "down" : "up",
  };
}

export class VisibleRangeStore {
  private snapshot: VisibleRange;
  private readonly listeners = new Set<Listener>();

  private scrollEl: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;

  private raf: number | null = null;
  private lastScrollTop = 0;

  private pageBlockHeight = 1;
  private totalCount = 1;
  private bufferBehind = 0;
  private bufferAhead = 0;
  private zoomRef: { current: number } | null = null;

  constructor(initial: VisibleRange) {
    this.snapshot = initial;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (cb: Listener) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  setConfig(input: {
    pageBlockHeight: number;
    totalCount: number;
    bufferBehind: number;
    bufferAhead: number;
    zoomRef?: { current: number };
  }) {
    this.pageBlockHeight = input.pageBlockHeight;
    this.totalCount = input.totalCount;
    this.bufferBehind = input.bufferBehind;
    this.bufferAhead = input.bufferAhead;
    this.zoomRef = input.zoomRef ?? null;
  }

  attach(scrollEl: HTMLElement | null) {
    if (this.scrollEl === scrollEl) return;
    this.detach();
    this.scrollEl = scrollEl;
    if (!scrollEl) return;

    const onScroll = () => this.schedule();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    this.ro = new ResizeObserver(() => this.schedule());
    this.ro.observe(scrollEl);

    this.detach = () => {
      scrollEl.removeEventListener("scroll", onScroll);
      this.ro?.disconnect();
      this.ro = null;
      if (this.raf != null) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.scrollEl = null;
    };

    this.schedule();
  }

  // replaced in attach()
  detach() {
    // no-op
  }

  schedule() {
    if (!this.scrollEl) return;
    if (this.raf != null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      const el = this.scrollEl;
      if (!el) return;

      const scrollTop = el.scrollTop;
      const viewportHeight = el.clientHeight;
      const prevScrollTop = this.lastScrollTop;
      this.lastScrollTop = scrollTop;

      const zoom = this.zoomRef?.current ?? 1;
      const scaledBlock = this.pageBlockHeight * zoom;

      const next = computeRange({
        scrollTop,
        viewportHeight,
        pageBlockHeight: scaledBlock,
        totalCount: this.totalCount,
        bufferBehind: this.bufferBehind,
        bufferAhead: this.bufferAhead,
        prevScrollTop,
      });

      if (sameRange(this.snapshot, next)) return;
      this.snapshot = next;
      for (const l of this.listeners) l();
    });
  }
}

