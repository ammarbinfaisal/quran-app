# Revision Plan & TODOs: High-Performance Mushaf Engine

Date: 2026-02-13

This file tracks concrete work items (plans + TODOs). Performance correctness decisions go in `docs/perf-decisions.md`.

## Constraints (Non-Negotiable)

- Zero CLS: page boxes are allocated on first paint; no layout jumps when data/fonts arrive.
- Zero flicker loops: no scroll/state feedback loop; the UI never writes scroll position in response to scroll.
- Bounded resource usage:
  - bounded mounted DOM nodes (windowed pages only)
  - bounded font cache memory (evictable, budgeted)
- Deterministic rendering:
  - render is a pure function of (page payload, settings, font-ready)
  - no runtime measurement during scroll

## Reference Policy

`./qcom-front` is UX reference only.

Do not reuse from `./qcom-front`:
- mushaf/ayaat rendering code
- scroll logic or observer logic
- font loading logic
- state architecture
- global font CSS
- any coupling of scroll events with React state

## Milestones

### M1 (P0) — Engine Skeleton + Stable Scroll

- [ ] Create `src/mushaf-engine/` with explicit boundaries:
  - runtime: cancellable payload + font requests, LRU eviction
  - windowing: range store derived from scrollTop, emits only on page-boundary changes
  - renderer: deterministic page render, no scroll reads
- [ ] Scroll mode virtualization:
  - absolute-position page frames inside a fixed-height spacer
  - fixed aspect ratio for each page frame (`1 / 1.6`)
  - zero measurement during scroll
- [ ] Placeholder strategy:
  - stable page box always present
  - show placeholder while payload/font pending
  - never render fallback font text

### M2 (P0) — Windowing + Prefetch Discipline

- [ ] Sliding window buffer defaults:
  - behind = 2 pages
  - ahead = 5 pages
- [ ] Direction-aware prefetch:
  - prioritize ahead of scroll direction
  - cancel in-flight requests for unpinned pages
- [ ] De-dup requests (single-flight per asset key).

### M3 (P0) — Font Virtualization (FontFace + Budgeted LRU)

- [ ] Load fonts via `FontFace` API per buffered page.
- [ ] Track approximate font bytes and enforce a budget (target 50MB).
- [ ] Evict fonts for pages outside the window (LRU; pinned pages never evicted).

### M4 (P1) — Swipe Mode

- [ ] Snap-to-page behavior (single page mounted plus neighbors pinned).
- [ ] Prefetch prev/next payload+fonts.
- [ ] Preserve page aspect ratio and full-screen fill.

### M5 (P1) — Zoom (Transform-Only)

- [ ] Support pinch/trackpad zoom in scroll mode without rerendering per frame:
  - apply `transform: scale()` on a single scroll content layer via refs/RAF
  - adjust scroll spacer height to scaled height
  - windowing uses scaled page block height
- [ ] Clamp zoom range.

### M6 (P0) — Perf Evidence (Playwright)

- [ ] Add a Playwright perf harness that does not rely on `next dev` listening on a port in this environment:
  - render the engine inside the Playwright page via `page.setContent()`
  - bundle a small React entrypoint with Bun for the test run
- [ ] Capture:
  - CLS (PerformanceObserver)
  - trace zip
  - start/end screenshots
- [ ] Output everything to `./ss_evidence`.

## Definition Of Done (P0)

- [ ] Scroll mode: no flicker loops while scrolling (no scroll writes, no observer loops).
- [ ] Layout: stable page boxes, no CLS from sizing or font swaps.
- [ ] Resource bounds: mounted pages <= window size; font cache enforced.
- [ ] Playwright: evidence artifacts exist under `./ss_evidence`.

