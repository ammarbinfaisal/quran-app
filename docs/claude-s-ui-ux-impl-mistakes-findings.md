# UI/UX & Implementation Mistakes — Claude's Findings

> Audit date: 2026-02-21
> Scope: Full codebase review against implementation plan, user requirements, and visual observations.

---

## CRITICAL Bugs

### C1 — Duplicate `TranslationRow` component (dead code, regression risk)
**Files:** `src/components/ayah/AyahSheet.tsx:212–296` · `src/components/ayah/TranslationRow.tsx`

`AyahSheet.tsx` defines its own private `TranslationRow` inline (with Abu Iyaad external link, `verseKey` prop, footnote handling). `TranslationRow.tsx` is a standalone file that is an older, stripped version — no `verseKey`, no external link. The standalone file is **imported nowhere** — dead code. Any future import of it will silently regress the Abu Iyaad external link feature.

**Fix:** Delete `src/components/ayah/TranslationRow.tsx`.

---

### C2 — `useShallowUrl` writes the wrong URL format in `VerseReader`
**Files:** `src/hooks/useShallowUrl.ts` · `src/lib/url.ts:12` · `src/components/reader/VerseReader.tsx`

`syncUrlToState` formats URLs as `/<mushaf>/<page>` (old route scheme). `VerseReader` is on `/v/<mushaf>/<view>`. After any state change, the address bar silently rewrites to the wrong path (e.g. `/v2/1` instead of `/v/v2/p:1`). Bookmarks from VbV mode land on a non-existent route.

**Fix:** `useShallowUrl` (or a separate hook for VbV) must format the URL as `/v/<mushaf>/<type>:<id>`.

---

### C3 — `ModeToggle`: VbV → Mushaf for surah/juz always navigates to page 1
**File:** `src/components/navigation/ModeToggle.tsx:22–27`

```ts
} else if (matchSurah) { router.push(`/p/${mushaf}/1`); }  // always page 1
} else if (matchJuz)   { router.push(`/p/${mushaf}/1`); }  // always page 1
```

The implementation plan requires using an IntersectionObserver to find the topmost visible verse and map it to its Mushaf page. This is **completely unimplemented**. Surah/Juz → Mushaf toggle always lands on page 1.

**Fix:** Implement viewport verse tracking in `VerseByVerseViewer`, expose it to `ModeToggle` via ref or context.

---

### C4 — `VerseReader` NavigationPicker `onNavigate` hardcodes `type="p"`, discards surah/juz context
**File:** `src/components/reader/VerseReader.tsx:119–131`

```ts
const t = "p";  // hardcoded — surah/juz context is permanently lost
setType(t as "p" | "s" | "j");
```

If the user is in `/v/v2/s:2` and jumps via nav picker, type resets to `"p"` silently. The user's context (surah view, juz view) cannot be recovered without navigating back.

**Fix:** NavigationPicker should return a typed navigation target, or `VerseReader` should preserve the current `type` on same-range navigation.

---

### C5 — `MushafPicker` uses `router.push` (hard navigation), conflicts with shallow-URL architecture; race condition with pref sync
**File:** `src/components/settings/MushafPicker.tsx:13–20` · `src/components/reader/Reader.tsx:70–75`

Architecture states: "URL is not the source of truth — synced via `history.replaceState`." But `MushafPicker` calls `router.push`, which fully remounts the page. This resets all local state (highlighted verse, open sheets, scroll). Worse, `Reader.tsx` has:

```ts
useEffect(() => {
  if (prefs.mushafCode !== initialMushaf) {
    setPref("mushafCode", initialMushaf);  // overwrites pref back to URL value
  }
}, [initialMushaf]);
```

Two competing writes cancel out — this is **accidental correctness**. Any change to ordering breaks it silently.

**Fix:** Use `router.replace` (not `push`) or `history.replaceState` for mushaf URL sync. Remove the pref-overwrite effect in `Reader.tsx` — the URL mushaf should be set once at mount, not policed on every render.

---

## High Severity Bugs

### H1 — `SurahHeader` `showBismillah` prop logic: Surah 1 (Al-Fatiha) gets double Bismillah in VbV mode
**Files:** `src/components/mushaf/SurahHeader.tsx:20–24` · `src/components/mushaf/VerseByVerseViewer.tsx` (VerseBlock)

`VerseByVerseViewer` always passes `showBismillah={true}` when `ayahNum === 1`, ignoring `chapter.bismillahPre`. For Surah 1, the Bismillah SVG renders as a header decoration *and* verse 1:1 contains the Bismillah text — theologically incorrect double rendering.
For Surah 9 (At-Tawbah), `SurahHeader` internally guards with `surahNumber !== 9`, but the parent still passes `showBismillah={true}` — **intent and implementation are misaligned** (parent says show, child silently overrides).

**Fix:** Pass `showBismillah={chapter.bismillahPre && chapter.id !== 1 && chapter.id !== 9}` from `VerseBlock`.

---

### H2 — `NavigationPicker`: page column is filtered by surah selection (should be independent); no Go button; `autoFocus` still present
**File:** `src/components/nav/NavigationPicker.tsx:116–143, 86`

Three violations of explicit requirements:
1. Page column narrows to surah's pages when a surah is selected (`start = selectedSurah.pages[0]`). Requirement: pages are always 1–604.
2. `handleAyahClick` immediately calls `onNavigate` — no confirmation "Go" button.
3. `autoFocus` still on search input (line 86) — explicitly requested removed.

---

### H3 — `generateStaticParams` uses `"indopak"` — not a valid `MushafCode`
**Files:** `src/app/v/[mushaf]/[view]/page.tsx:14` · `src/app/[mushaf]/m/[lemma]/page.tsx:4`

```ts
const mushafCodes = ["v1", "v2", "v4", "indopak"];  // "indopak" doesn't exist
```

`MUSHAF_CODES = ["v1", "v2", "v4", "qpc", "i15", "i16"]`. All statically generated `indopak` routes build but render `<InvalidPathMessage>` at runtime. Real IndoPak codes (`i15`, `i16`) are never statically generated.

---

### H4 — `VerseByVerseViewer` IntersectionObserver sentinel ref can be null on re-registration
**File:** `src/components/mushaf/VerseByVerseViewer.tsx:57–66`

When `type`/`id` changes (e.g. surah → juz), `fullPageRange` changes, `pagesToShow` resets to 5. The `useEffect` re-runs with `[fullPageRange.length]` dependency. But if the sentinel div was not rendered in the previous render cycle (because `pagesToShow >= fullPageRange.length`), `observerRef.current` is null when `observer.observe()` is called — the lazy-load mechanism silently dies.

---

### H5 — `MushafLine` passes raw array index to morphology lookup (not word-only count)
**File:** `src/components/mushaf/MushafLine.tsx:30–31` · `src/components/mushaf/MorphologySheet.tsx:58–60`

`MushafLine` passes `wordIndex={idx}` (raw index over all tokens including pause marks, end-markers). `MorphologySheet` queries `surah:ayah:wordIndex+1` — but corpus uses 1-based count of **actual words only** (`charTypeName === "word"`). Morphology lookup is wrong for any line with non-word tokens.

`VerseByVerseViewer` and `VerseCard` correctly compute `morphIndex` via `charTypeName` filtering — the fix was applied there but **not to the Mushaf page path** (`MushafLine`).

---

## Medium Severity

### M1 — `VerseReader` mushaf pref sync updates state but not URL; race with `MushafPicker` router.push
**File:** `src/components/reader/VerseReader.tsx:53–57`

Settings change → `setMushafCode(prefs.mushafCode)` updates local state. Then `MushafPicker` also fires `router.push`. The stale `useShallowUrl` debounce from the old page may fire and rewrite the URL to the wrong format. Two async writes compete with no ordering guarantee.

---

### M2 — `MushafPage` uses `chapter.bismillahPre` (Madani-specific) for all mushaf types
**File:** `src/components/mushaf/MushafPage.tsx:43–50`

`bismillahPre` from the chapters API reflects Madani mushaf layout. For IndoPak/KFGQPC mushafs, the slot detection already works from actual empty lines in the page data — but the `bismillahPre` flag can incorrectly suppress Bismillah rendering if there's a data discrepancy.

---

### M3 — Juz page ranges use Madani `JUZ_PAGE_RANGES` constant for all mushaf types
**File:** `src/components/mushaf/VerseByVerseViewer.tsx:36–45`

`JUZ_PAGE_RANGES` is hardcoded for Madani (v2) pagination. IndoPak 15/16-line mushafs have different page counts per juz. Loading `/v/i15/j:1` will fetch the wrong pages — first/last verses of the juz will be missing or belong to adjacent juzaa.

---

### M4 — `NavigationPicker` ayah navigation always uses first page of surah, ignores actual ayah page
**File:** `src/components/nav/NavigationPicker.tsx:61–67`

```ts
callOnNavigate(selectedSurah.pages[0], verseKey);  // always surah's first page
```

Jumping to Surah 2, Ayah 100 lands on page 2 (start of Al-Baqarah) not the actual page of verse 2:100. In Mushaf mode the page is wrong; only the highlight is correct.

---

### M5 — `url.ts` `syncUrlToState` / `parseUrlState` use deleted `/[mushaf]/[page]` route format
**File:** `src/lib/url.ts:12, 25`

Old routing was `/<mushaf>/<page>`. New routing is `/p/<mushaf>/<page>`. Both functions generate/parse the old format. `parseUrlState` is no longer called. `syncUrlToState` called from `useShallowUrl` generates wrong URLs for both Reader and VerseReader.

---

## Visual / UX Findings (from user observations)

### V1 — KFGQPC Hafs takes full screen width (no page containment)
KFGQPC (`qpc`) is a Unicode font but its words render at a large size that fills the full viewport width. The mushaf page container (`aspect-ratio: 1/1.6`) should constrain it like v1/v2/v4, but KFGQPC text does not respect the same sizing constraints — no `max-width` applied to individual word spans for Unicode mushafs.

### V2 — IndoPak (i15 / i16) takes full screen width
Same root cause as V1. IndoPak Nastaleeq glyphs are tall and wide. The `.mushaf-line-unicode { justify-content: space-between }` rule spreads words across the full line width, but no font-size cap forces the page to stay within the aspect-ratio container. On wide screens this breaks the physical book appearance.

### V3 — IndoPak and KFGQPC: any word tap opens Translation sheet instead of Morphology
`MushafWord.onTap` calls `onWordTap(word.verseKey, wordIndex)`. In `SwipeReader` → `Reader.tsx`, `handleWordTap` sets `selectedVerse` which opens `AyahSheet`. There is no code path that distinguishes Unicode vs QCF taps — all taps open the translation sheet for all mushaf types. IndoPak/KFGQPC do not support morphology (no `charTypeName` word-index mapping exists for them in the corpus), so morphology should be suppressed for non-QCF codes, and the tap should still open translation correctly. Currently the translation sheet does open — the bug is that morphology is also attempted for these codes in `VerseReader`'s `handleWordTap`.

### V4 — VbV mode: Arabic font size is enormous on desktop (fontScale=4)
`VerseByVerseViewer` VerseBlock applies:
```tsx
style={{ fontSize: `${(prefs.fontScale ?? 1) * 100}%` }}
```
At `fontScale=4`, Arabic renders at `400%` base size — massive on desktop. The fontScale range is 1–10 (per `DEFAULT_PREFERENCES: fontScale: 3`), and `100%` per unit means `300%` at default. This is intentionally mobile-first but has no cap for desktop viewports.

Translation font is set to:
```tsx
style={{ fontSize: `${Math.max(0.8, (prefs.fontScale ?? 1) * 0.9)}rem` }}
```
At fontScale=4 this is `3.6rem` — larger than most body text should be. Both need viewport-aware clamping, and the translation should remain clearly smaller than the Arabic.

### V5 — v1/v2/v4 justification: v2 > v4 > v1 (confirmed working, not a bug)
User confirmed visual order is correct. v2 has the best justification. No code change needed.

---

## Architecture Notes

### A1 — `url.ts` is effectively legacy
The entire `url.ts` file (`syncUrlToState`, `parseUrlState`) was written for the old `/<mushaf>/<page>` routing. With the new `/p/` and `/v/` routes, these helpers are either dead or generating wrong URLs. They should be replaced with route-aware URL builders.

### A2 — `MushafPicker` is route-aware but `Reader`/`VerseReader` treat URL as read-only
The two sides of the mushaf-switch flow (`MushafPicker` writes URL, `Reader` reads initialMushaf from server props) are architecturally inconsistent. Either the URL drives everything (SSR route params) or preferences drive everything (client localStorage). Currently it is half-and-half with accidental correctness gluing them together.

---

## Fix Priority Order

1. C1 — Delete dead `TranslationRow.tsx`
2. C5 — Fix `MushafPicker` to use `router.replace` + remove pref-overwrite in `Reader.tsx`
3. C2 — Fix `useShallowUrl` / `url.ts` for `/v/` route format
4. H3 — Fix `generateStaticParams` invalid `"indopak"` code
5. H5 — Fix morphology word index in `MushafLine`
6. H1 — Fix Bismillah double-render for Surah 1 in VbV
7. H2 — Fix `NavigationPicker` (page independence, no autoFocus, Go button)
8. C3 — Implement viewport verse tracking for ModeToggle VbV→Mushaf
9. V1/V2 — Fix Unicode mushaf (KFGQPC, IndoPak) page containment / font sizing
10. V3 — Suppress morphology sheet for non-QCF codes in `VerseReader`
11. V4 — Add viewport-aware clamp to VbV Arabic font size; fix translation font ratio
12. M3 — Fix juz page ranges for non-Madani mushafs
