# Static Mushaf Rendering Plan

## Objective
Build a high-performance mushaf mode where:

1. The selected mushaf font is correct on first paint (no visible fallback swap).
2. All Quran.com font-based mushaf variants are supported.
3. Runtime font/data fetch latency is minimized when paging or switching mushaf.

---

## Current State (This Repo)

- Reader uses `open-quran-view` via `dynamic(..., { ssr: false })` in `src/components/MushafViewer.tsx`.
- Settings are localStorage-only and hydrated in `useEffect` (`src/context/SettingsContext.tsx`), so initial render can differ from persisted user preference.
- Supported layouts are currently only:
  - `hafs-v2`
  - `hafs-v4`
  - `hafs-unicode`
- Pages/routes are static, but mushaf rendering/font loading is client-only at runtime.

Implication: first paint cannot be guaranteed to match user-selected mushaf/font in all cases.

---

## What I Found

## 1) `open-quran-view` (local clone: `/tmp/quran-research/open-quran-view`)

- Strong static-asset pipeline:
  - Generated static font/data URL maps (`src/core/static/fonts.ts`, `src/core/static/data.ts`).
  - Bundled local font files + local page JSON.
- Rendering is simple and fast to integrate, but:
  - Only 3 layouts.
  - Font is still loaded page-by-page with `FontFace` at runtime (`src/core/font-loader.ts`).
  - Page data is loaded as large full-layout JSON blobs (`src/core/data-loader.ts`).
  - Spacing/layout logic is simpler than Quran.com (less exact mushaf typography behavior).

## 2) `quran.com-frontend-next` (local clone: `/tmp/quran-research/quran.com-frontend-next-src`)

- Supports broader font/mushaf matrix (`types/QuranReader.ts`):
  - `code_v1`, `code_v2`, `tajweed_v4`, `text_uthmani`, `text_indopak` (15/16 lines), `qpc_uthmani_hafs`, `tajweed`
- Typography/layout system is mature:
  - Line grouping by page/line (`groupLinesByVerses.ts`)
  - Font/line-width scale classes (`src/styles/_utility.scss`, `VerseText.module.scss`, `ReadingView.module.scss`)
  - Line-level alignment behavior closer to real mushaf layout.
- But QCF fonts are loaded dynamically per page via `FontFace` in `useQcfFont`:
  - Fallback text/font shown first, then upgraded when page font finishes loading (`GlyphWord.tsx`, `useIsFontLoaded.ts`).
  - This is exactly the mismatch behavior you want to eliminate.

---

## Target Architecture

## A) Support all Quran.com font-based mushaf types

Adopt full font/mushaf matrix compatible with Quran.com naming/mushaf IDs:

- `code_v1` (mushaf 2)
- `code_v2` (mushaf 1)
- `tajweed_v4` (mushaf 19)
- `text_uthmani` (mushaf 4)
- `text_indopak` + `15_lines` (mushaf 6)
- `text_indopak` + `16_lines` (mushaf 7)
- `qpc_uthmani_hafs` (mushaf 5)
- `tajweed` (mushaf 11)

## B) Static local assets with generated manifests

Create build-time generation pipeline (similar to open-quran-view, but expanded):

- `scripts/generate-mushaf-assets.ts`:
  - fetch per-page verse/word layout data for each mushaf ID
  - normalize into compact per-page JSON
  - generate font manifest per mushaf/page
- Output:
  - `public/mushaf-data/{mushafKey}/p{page}.json`
  - `public/mushaf-fonts/...` (local static font files)
  - `src/generated/mushaf-manifest.ts` (typed lookup tables)

No runtime API dependency for mushaf pages/fonts.

## C) First-paint font correctness

Use a server-readable preference (cookie) instead of localStorage-only preference.

- On request:
  - read mushaf/font setting on server
  - preload current page font with `<link rel="preload" as="font">`
  - emit deterministic font-face for current page/font key
- On client:
  - do not render fallback glyph text for QCF pages
  - render skeleton until exact current page font is ready

Result: no visible font swap after paint.

## D) Mushaf renderer strategy

Build an in-repo renderer that combines:

- Quran.com typography behaviors (line grouping + line-width/font scale maps + centered pages/lines)
- Open-quran-view-style static local data approach

This removes dependence on open-quran-view limitations while keeping static self-contained behavior.

---

## Paging and Mushaf-Switch Performance Plan

## Page navigation

- Keep page data cache in memory keyed by `{mushafKey, page}`.
- Preload font + data for `current`, `next`, `prev` page.
- On page flip:
  - if ready: instant swap
  - if not ready: show page skeleton (not wrong font text)

## Mushaf switch

- On switch request:
  - keep current page visible
  - concurrently load target mushaf page data + page font
  - swap only when target page is ready
- Optionally warm nearest 2 pages in background after swap.

This addresses your concern about DOM rerender delays on mushaf changes.

---

## Phased Implementation

## Phase 1: Settings + Manifest Foundation

- Add cookie-backed mushaf preferences (server/client sync).
- Define canonical `MushafFont` + `MushafLines` types matching Quran.com.
- Introduce generated manifest contract and loader APIs.

## Phase 2: Static Asset Generation

- Build scripts to generate per-page static JSON and font manifests.
- Integrate into build/dev workflow.
- Validate output for all target mushaf/font combinations.

## Phase 3: New Renderer

- Implement line-group renderer with Quran.com-like spacing/alignment behavior.
- Replace `open-quran-view` usage in `MushafViewer`.
- Keep word click/translation sheet integration intact.

## Phase 4: First-Paint Correctness + Prefetch

- Server preload for active page font.
- Exact-font gate (no fallback swap).
- Adjacent-page data/font prefetch.

## Phase 5: Verification

- Measure and enforce:
  - no post-paint font swap
  - page change latency targets
  - CLS near zero on mushaf paint/switch
- Add regression tests for font correctness and mushaf switch behavior.

---

## Decisions Locked

## 1) Packaging model

- Use per-page packaged data with protobuf encoding.
- Plan:
  - `public/mushaf-data/{mushafKey}/p{page}.pb`
  - optional build output for debug: `p{page}.json`
- Reason: smaller payloads, deterministic decode cost, page-wise caching/prefetch.

## 2) First-paint policy

- Strict mode: render skeleton until exact page font is ready.
- No fallback-font paint for mushaf glyphs.

## 3) Tajweed/font asset policy

- Phase 1: COLRv1 support first.
- Render policy: do not show tajweed color layers in UI (monochrome rendering policy).
- Phase 2: keep full parity asset support (including OT-SVG variants) for compatibility paths, with programmatic optimization/compression in the build pipeline.

## 4) Renderer direction

- Fork/extend `open-quran-view` and build on top of it.
- Attribution plan:
  - keep clear upstream attribution in `README` and headers where appropriate
  - preserve upstream history when feasible for contributor visibility
  - if history-preserving import is not practical, add explicit credit commits and docs.

## 5) Preference persistence

- Source of truth: cookie + localStorage mirror.
- Cookie drives SSR/first paint; localStorage mirrors for client speed/offline continuity.

## 6) Compact URL codes for preferences

Use short `:`-tokenized route segments so paths reflect mushaf + translation preference.

- Canonical pattern:
  - `/{surah}/{ayah?}/r/m:{mCode}/t:{tCode}/`
- Examples:
  - `/2/255/r/m:v2/t:n/` (Madani V2, no translation mode)
  - `/18/r/m:i5/t:tr131/` (Indopak 15-line, translation 131)
  - `/1/1/r/m:ut/t:tr20/` (Uthmani text, translation 20)

Redirect behavior:

- Bare route support stays enabled for fast manual typing:
  - `/5/`
  - `/5/10/`
- Bare routes 302/307 redirect to canonical preference route using cookie defaults:
  - `/5/` -> `/5/r/m:{cookieMCode}/t:{cookieTCode}/`
  - `/5/10/` -> `/5/10/r/m:{cookieMCode}/t:{cookieTCode}/`
- If cookie is missing, use locale default preferences.

Suggested code map:

- Mushaf (`m:{mCode}`)
  - `v1` = `code_v1`
  - `v2` = `code_v2`
  - `t4` = `tajweed_v4` (monochrome render policy)
  - `ut` = `text_uthmani`
  - `i5` = `text_indopak` + `15_lines`
  - `i6` = `text_indopak` + `16_lines`
  - `qh` = `qpc_uthmani_hafs`
  - `tj` = `tajweed`

- Translation (`t:{tCode}`)
  - `n` = no translation (Arabic-only reading mode)
  - `tr{ID}` = single translation id, e.g. `tr131`
  - `d` = default translation for locale
