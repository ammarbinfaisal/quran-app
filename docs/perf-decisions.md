# Performance Decisions: Mushaf Engine

Date: 2026-02-13

This file is an append-only-ish decision log for performance correctness. If a decision changes, add a new entry that supersedes the old one.

## D-001 — One-Way Scroll Data Flow

**Decision:** Scroll position is the only source of truth for visible range. Visible range determines pinned pages. Pinned pages determine data/font requests. Render is a pure function of (payload, settings, font-ready).

**Forbidden:**
- render -> effect -> scroll correction -> observer -> render loops
- writing `scrollTop` in response to scroll-derived state
- `setState` in scroll listeners/observers

**Rationale:** Prevents feedback loops that cause flicker/jitter.

## D-002 — Stable Layout Via Fixed Page Frames

**Decision:** Every page frame reserves layout immediately using a fixed aspect ratio (`1 / 1.6`) and fixed positioning within a spacer. No runtime measurement is performed during scroll.

**Rationale:** Eliminates CLS and avoids reflow storms.

## D-003 — Font Virtualization With FontFace API (No Global @font-face)

**Decision:** Fonts are loaded per buffered page using the `FontFace` API. Fonts are cached in an evictable LRU under a strict byte budget. Fonts for pinned pages are never evicted.

**Rationale:** Bounded memory usage and no global font churn.

## D-004 — FOIT Over FOUT (No Fallback Flash)

**Decision:** Never render Quran text with fallback fonts. If the page payload or font is not ready, show a stable placeholder and keep text hidden.

**Rationale:** Fallback glyph metrics are wrong and perceived as flicker.

## D-005 — Windowing Emits Only On Discrete Page-Boundary Changes

**Decision:** The visible-range store only publishes when integer page indices change (first/last visible, start/end window). It does not publish raw `scrollTop` at scroll event frequency.

**Rationale:** Keeps React renders bounded and predictable.

## D-006 — Zoom Is Transform-Only + Spacer-Scaled (No React State Per Frame)

**Decision:** Zoom is implemented by applying `transform: scale()` to a single scroll content layer via refs/RAF and scaling the spacer height accordingly. Windowing uses scaled page block height.

**Rationale:** Supports zoom without rerender storms and without introducing layout shifts.

## D-007 — Page Coordinate Space (Initial Contract)

**Decision:** Treat payload `x/width` coordinates as a fixed-width space of `0..100` unless/until assets prove otherwise.

**Rationale:** Keeps rendering deterministic without scroll-time measurement. If assets change, update this entry with the canonical coordinate system.

