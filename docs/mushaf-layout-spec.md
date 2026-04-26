# Mushaf Layout Spec & UI Assumptions

> **Read before changing any CSS or component touched by the mushaf reader.**
>
> Last verified: 2026-04-25 against commit `4110c5ae`. Re-verify if any of the load-bearing files below change.

This document is the source of truth for how the mushaf page is laid out, what each element is responsible for, and which assumptions other code relies on. It exists so a CSS or component change in one place doesn't silently break swipe physics, audio sync, deep-linking, scroll mode, or test suites elsewhere.

---

## 1. The element graph

```
<body> (overflow:hidden, position:fixed)
└── <main> (h-full, overflow-hidden)
    └── <div min-h-0 flex-1>
        └── <SwipeReader>
            └── .swipe-container (overflow:hidden, height:100%, touch-action:pan-y)
                └── .swipe-track (display:flex, height:100%, will-change:transform)
                    └── .swipe-page × 3 slots (flex:0 0 100%, height:100%, padding:8px,
                                               align-items:center, justify-content:center)
                        └── .mushaf-page (the printed-mushaf card)
                            ├── 15 line slots (flex-1 OR h-[calc(100%/15)])
                            │   └── .mushaf-line (inline-size: var(--mushaf-line-width))
                            │       └── .mushaf-word × N (inline-block, white-space:nowrap)
                            └── .page-number (h-4, flex-shrink-0)
```

Source files:
- `src/components/mushaf/SwipeReader.tsx` — engine
- `src/components/mushaf/MushafPage.tsx:231` — `.mushaf-page` JSX
- `src/components/mushaf/MushafLine.tsx:33` — `.mushaf-line` JSX
- `src/components/mushaf/MushafWord.tsx:77` — `.mushaf-word` JSX
- `src/app/globals.css:212–530` — all CSS rules

---

## 2. CSS contract per element

### `.mushaf-page` (globals.css:345–379)

Defines locals (any descendant can read these):
- `--mushaf-page-width: min(95vw, calc(90vh / 1.6))` — page width formula.
- `--mushaf-line-width: var(--mushaf-page-width) * 0.92` — line container width.
- `--mushaf-base-size: var(--mushaf-line-width) / 16.32` — font-size, calibrated against the binding sumW/fontPx ratio measured on p254/p255.

Layout:
- `aspect-ratio: 1 / 1.6` + `width: var(--mushaf-page-width)` → height derived. ⚠️ **Not matching quran.com's 1:1.77 aspect.**
- `display: flex; flex-direction: column; justify-content: space-between` — pins page-number footer to bottom.
- `padding-inline: calc((page-width - line-width) / 2)`, `padding-block: calc(page-width * 0.04)` — both percent-of-self via CSS var, never percent-of-parent.
- `overflow: hidden`. ⚠️ **Vertical content overflow gets clipped; no scroll affordance.**
- `font-size: var(--mushaf-base-size)`.

JSX adds (`MushafPage.tsx:231`): `relative w-full h-full flex flex-col justify-between` plus inline `style={{justifyContent:'center'}}` for special pages 1–2. **`w-full` and `h-full` win over the CSS `width` and `aspect-ratio`-derived height** — they currently don't matter because the parent (`.swipe-page`) has matching dimensions, but if any wrapper changes, `h-full` will keep forcing 100% of parent height.

### `.mushaf-line` (globals.css:254–267)

- `display: block; direction: rtl; text-align: center`.
- `inline-size: var(--mushaf-line-width)` — explicit width, not `100%`.
- `margin-inline: auto`.
- `line-height: 1`. ⚠️ **Tighter than quran.com (1.354). Visual breathing room currently comes from `space-between` distributing slack across line slots.**
- `white-space: nowrap` — prevents sub-pixel rounding overshoot from wrapping. **Do NOT add `overflow: hidden`** — QCF glyph ink extends ~23% above and below the line-box (descenders, marks, ligature tails) and would be clipped.

### `.mushaf-word` (globals.css:295–312)

- `display: inline-block; cursor: pointer; white-space: nowrap`.
- Word gaps are 0 between adjacent inline-blocks **by design** — QCF font handles inter-word spacing internally via glyph advance widths. Same as quran.com (~0.45px gap, effectively zero).
- Highlight states via `[data-highlighted="true"]` + `[data-phrase-color-index="1..7"]`.

### `.swipe-container / .swipe-track / .swipe-page` (globals.css:386–416)

- All three have `height: 100%` and `width: 100%`-equivalent.
- `.swipe-container { overflow: hidden; touch-action: pan-y pinch-zoom; overscroll-behavior-x: contain }`.
- `.swipe-page { padding: 8px; align-items: center; justify-content: center }` — vertically centers a content-shorter `.mushaf-page` and clips a content-taller one.

### `.scroll-container` (globals.css:422–427)

- `overflow-y: auto; height: 100%; scroll-behavior: smooth`.
- Used by ScrollModeReader. Already supports content-driven page height. **Reference for how to make swipe scrollable too if needed.**

---

## 3. CSS variable graph

```
viewport (vw, vh)
└── --mushaf-page-width = min(95vw, 90vh/1.6)             [.mushaf-page]
    ├── width                                              (line 365)
    ├── padding-inline / padding-block                     (370–371)
    └── --mushaf-line-width = page-width × 0.92
        ├── .mushaf-line inline-size                       (258)
        └── --mushaf-base-size = line-width / 16.32
            └── font-size (cascades to all descendants)    (378)
```

Dead variables (declared but unused in mushaf rules):
- `--mushaf-font-scale` (globals.css:36) — set by user pref, **never read**.
- `--color-borders-hairline` — does not exist; mushaf uses `color-mix(...)` instead.

---

## 4. Hard contracts (engine breaks if violated)

### 4.1 SwipeReader is pure-X horizontal physics
- Only reads `container.clientWidth` (`SwipeReader.tsx:139, 216`). **No height read anywhere.**
- Translates only `translate3d(${offsetX}px, 0, 0)`. No `vh`, no percentage-of-height.
- Therefore `.mushaf-page` height changes are invisible to commit math.
- Tests `tests/swipe-engine.spec.ts` (S1–S9) are X-only and don't catch height regressions.

### 4.2 Three slots, each = container width
- `.swipe-page { flex: 0 0 100%; min-width: 100% }` is required for the prev/current/next geometry.
- Track is 3 × W wide; commit targets are at `0`, `W`, `2W`.

### 4.3 Wheel handler treats `|deltaY|>20` as page-advance
- `SwipeReader.tsx:186–192`. **If any ancestor becomes scrollable, wheel-scroll inside the page will be hijacked as page-change.** Currently safe because the entire stack is `overflow:hidden`.

### 4.4 Page-number footer is bottom-pinned via flex
- `MushafPage.tsx:235` is the last flex child of `.mushaf-page`.
- `justify-content: space-between` (globals.css:369) pushes it to the bottom only because the page has determinate height.
- Special pages 1–2 use inline `justify-content: center`; footer rides immediately under the centered lines.

### 4.5 QCF font is scale-invariant; divisor is calibrated
- `--mushaf-base-size = line-width / 16.32` was measured by `scripts/measure-binding-ratio.ts` across all 604 v2 pages at viewport 390×844.
- The binding pages are p254 and p255. If you change `--mushaf-line-width`, **re-run that script** and update the divisor.
- `tests/mushaf-line-boundaries.spec.ts` (1208 cases) verifies no page overflows.

### 4.6 Body / main / swipe stack is non-scrollable
- `body { overflow: hidden; position: fixed; inset: 0 }` (globals.css:219–223).
- `main { overflow: hidden }`.
- `.swipe-container { overflow: hidden }`.
- **No ancestor can scroll today.** Any code that calls `scrollIntoView` on a descendant will scroll the layout viewport itself — on iOS this is unrecoverable because body is fixed.

### 4.7 `useRecitationPlayer` calls `scrollIntoView`
- `src/hooks/useRecitationPlayer.tsx:350`. Targets `[data-verse-key="${currentVerse}"]`. Currently a no-op visually because the page fits within viewport. **Will scroll the layout viewport on short viewports if mushaf becomes taller than viewport.**

---

## 5. Soft contracts (cosmetic; survive but may look wrong)

### 5.1 `.swipe-page` vertically centers the page
- If `.mushaf-page` becomes taller than its slot, `align-items: center` clips top AND bottom symmetrically.
- Switching to `align-items: flex-start` is required for taller pages.

### 5.2 `.mushaf-line-unicode { max-height: 100% }` (line 270)
- Constrains within a determinate-height parent. If `.mushaf-page` becomes content-driven (`height: auto`), `max-height: 100%` resolves to `none`.
- Used by `ArabicVerseBlock.tsx:240` outside mushaf (intrinsic height — fine there).

### 5.3 Line slots use `flex-1` or `h-[calc(100%/15)]`
- `MushafPage.tsx:177–178`. Both presume parent has determinate height.
- With content-driven height, special pages (1, 2) lose per-line equal distribution.

### 5.4 `PageSkeleton.tsx`
- 15 fixed-height skeleton bars. Needs height parity if mushaf height changes.

---

## 6. Differences from quran.com (reference implementation)

Measured against `https://quran.com/page/7?readingMode=arabic` at viewport 500×406:

| Property | quran.com | Ours | Impact |
|---|---|---|---|
| Page aspect ratio | ~1:1.77 (495×878) | 1:1.6 (228×365) | Ours is wider per row of text |
| Page sizing strategy | `inline-size: fit-content` (page sized by line) | `aspect-ratio + width formula` | Ours force-fits; theirs is content-driven |
| Page height vs viewport | 2× viewport → **scrolls** | Forced into 90vh → **compresses** | Ours becomes cramped at short viewports |
| `line-height` | `21.664px` (font 16px) → ratio **1.354** | `1` (= fontSize) | Ours has no internal line breathing room |
| Vertical stride between lines | = line-height (no extra gap) | Comes from `flex space-between` | Different spacing source |
| Inter-word gap | 0.45px (font-driven) | 0px (font-driven) | Equivalent ✓ |
| Word display | `inline-block; white-space: nowrap` | same | Equivalent ✓ |
| Line text-align / direction | `text-align: center; direction: rtl` | same | Equivalent ✓ |
| Line `inline-size` | hand-tuned table per (font, font-scale, viewport) | derived `pageW × 0.92` | Different sources, equivalent shape |
| Line wrapping | not possible — fits by font calibration | not possible — `nowrap` enforced | Equivalent ✓ |

**The key behavioral difference:** quran.com lets the page exceed viewport and the user scrolls. We try to fit the entire page (15 lines + frame) into 90vh and shrink the font when the viewport is short — which produces visual cramping below ~700px viewport height.

---

## 7. Risks when changing `.mushaf-page` to content-driven height

Ordered by severity:

1. **`useRecitationPlayer.scrollIntoView`** could scroll the layout viewport irreversibly on iOS (body is `position: fixed`). Mitigation: add a scrollable inner container; have scrollIntoView target it.
2. **`.mushaf-page { overflow: hidden }`** clips its own content if height grows. Mitigation: change to `overflow: visible` or restructure.
3. **`.swipe-page { align-items: center }`** centers and clips a content-taller page. Mitigation: switch to `flex-start` and add `overflow-y: auto` on `.swipe-page`.
4. **Wheel-handler hijacks vertical scroll** as page-change (`SwipeReader.tsx:186`). Mitigation: gate on `target.closest('.swipe-page')` having no remaining scroll room.
5. **`MushafPage` line slots use `flex-1` / `h-[calc(100%/15)]`** for special pages 1–2. Mitigation: add `min-height` per slot or rework special-page layout.
6. **Page-number footer loses bottom-pinning** when no slack remains. Mitigation: add `margin-top: auto` to the footer.
7. **`MushafPage.tsx:231` Tailwind `h-full`** keeps forcing 100% parent height. Must drop or override to allow content-driven sizing.
8. **`PageSkeleton`** needs height parity rework.

---

## 8. Where data flows, no measurement happens

Reader.tsx, MushafPage, MushafLine, MushafWord — **none** of these measure page height, viewport, or scroll position. All highlight/phrase/audio data flows via React render or `setAttribute` against data attributes. The only measurement code paths are:

- `useRecitationPlayer.tsx:350` — `scrollIntoView` (item 7 in §4).
- `viewport.ts:5–36` — used by ScrollModeReader only, not the swipe reader.
- `wordTap.ts:30, 56` — `getBoundingClientRect` for keyboard-fallback tap anchor.
- `FloatingWordMenu.tsx:35–58` and `InPlaceNotes.tsx:48–75` — `useLayoutEffect` clamps popovers to `window.innerWidth/Height`.
- `SwipeReader.tsx:139, 216` — `clientWidth` only.

---

## 9. Constants + assumptions about line count

- `TOTAL_PAGES = 604` (`src/lib/constants.ts:1`).
- `LINES_PER_PAGE = 15` (`src/lib/constants.ts:3`) — defined but not currently imported. The 15-line assumption is hardcoded in `MushafPage.tsx:32` (`maxLines`) and `[calc(100%/15)]` (line 177).
- `MUSHAF_LINES.v2 = 15` (`src/lib/types.ts:15`).
- `INDOPAK_TOTAL_PAGES`: not present in this branch despite earlier memory notes — Indopak code paths are not in this codebase. Document them when added.

---

## 10. Tests, scripts, generated assets — what depends on layout

### Tests (pass without CSS change)
- `tests/mushaf-line-boundaries.spec.ts` — 604 cases × 2 projects (chromium + Pixel 5). Asserts horizontal-only: line edges flush within 3px, glyph ink within 1px. **Must re-run after any `.mushaf-line` width change.**
- `tests/swipe-engine.spec.ts` — 9 horizontal-only state-machine tests. Will not catch wheel-hijack or vertical-clip regressions.

### Scripts to re-run after layout change
- `scripts/measure-binding-ratio.ts` — recompute the divisor (currently 16.32) for any change to `--mushaf-line-width`.
- `scripts/check-multiplier-viewports.ts` — sweep 7 viewports × 9 pages, verify no overflow.

### Scripts unaffected
- `scripts/measure-mushaf-multiplier.ts` (uses CSS override that bypasses `--mushaf-line-width`).
- `scripts/check-font-scale-invariance.ts`.
- `scripts/generate-mushaf-assets.ts`, `scripts/generate-navigation-maps.ts` — pure data; no layout coupling.

### Lean proofs unaffected
- `proofs/SwipeEngine/SwipeEngine/Basic.lean` — height-agnostic state machine.

### Generated assets unaffected
- `public/mushaf-data/v2/p001..p604.{json,pb}` — content only, no geometry baked in (placeholder `x, width` are recomputed in CSS).
- `public/mushaf-fonts/v2/p001..p604.woff2` — fonts.
- `public/data/{verse,surah,juz}-pages.*.json` — page-number maps only.

---

## 11. URL update contract (separate from layout)

Currently `Reader.tsx:95, 223`, `VerseReader.tsx:113, 203, 234, 263`, `ScrollModeReader.tsx:82, 167, 198, 227` all use `router.replace` / `router.push` from Next.js. **Every call triggers a Next.js segment refetch + render.** For pure URL-mirror updates (e.g., post-swipe), this is a bug — should be `window.history.replaceState(null, "", path)` so the address bar updates without re-running the route loader. Tracked separately from this doc; mentioned here because it's the most common cause of "swipe feels slow / page reloads."

---

## 12. Process for safely changing layout

1. Read this doc.
2. Identify which contracts §4–§5 your change touches.
3. For each touched contract: verify the test/script in §10 still passes, OR update the contract here in the same PR.
4. After CSS change, re-run `bun run scripts/check-multiplier-viewports.ts` to verify no overflow.
5. If line-width formula changes: also re-run `bun run scripts/measure-binding-ratio.ts` and update the divisor in `globals.css:362`.
6. Run `bun x playwright test` (1208 boundary cases + 9 swipe cases × 2 projects).
7. Manually verify on at least 3 viewports: tall phone (390×844), tablet (768×1024), short window (≥500×406).
