# Mobile UX Implementation Plan

## Goal
Improve the mobile ergonomics of the Quran App by adopting best practices from `docs/mobile-ux-guidelines.md`, specifically focusing on "Thumb Zone Design", touch targets, and bottom-anchored navigation.

## Analysis of Current State
- **Header Navigation**: ~~Checks top header with Home, Surah Picker, downloads, settings. Hard to reach on large phones.~~ **DONE** — moved to bottom nav.
- **Reading Experience**: Swipe/Scroll readers exist. **DONE** — immersive mode added.
- **Touch Targets**: ~~Need verification.~~ **DONE** — all interactive elements now ≥48px.

## Implemented Changes

### 1. Bottom Navigation Bar (Thumb Zone)
Moved all primary navigation to a fixed bottom bar:
- **Left**: Home icon (48×48px touch target)
- **Center**: Page number with book icon (tap opens SurahPicker)
- **Right**: Download manager + Settings icons (48×48px each)
- Safe-area-inset-bottom padding for notched devices

**Files**: `src/components/reader/Reader.tsx`, `src/app/globals.css`

### 2. Immersive Reading Mode
- Bottom bar auto-hides after 2.5s of inactivity
- Scroll down → hide bar, scroll up → reveal bar
- Tap on reading area toggles bar visibility
- Smooth CSS transition for show/hide

**Files**: `src/hooks/useImmersiveMode.ts`, `src/components/reader/Reader.tsx`

### 3. SurahPicker → Bottom-Anchored
- Flipped from `top-0 rounded-b-2xl` to `bottom-0 rounded-t-2xl`
- Added sheet handle at top
- Close button enlarged to 48×48px
- Safe-area-inset-bottom padding

**Files**: `src/components/nav/SurahPicker.tsx`

### 4. DownloadManager → Bottom Sheet
- Converted from centered modal to bottom-anchored sheet
- Added sheet handle, safe-area-inset
- **Abu Iyaad enforcement**: auto-downloads alongside saheeh/hilali-khan; shown as read-only "always included" badge; only removed when all other translations are removed
- All action buttons enlarged to proper touch targets

**Files**: `src/components/offline/DownloadManager.tsx`

### 5. Touch Target Audit
All interactive elements now meet ≥48px minimum:
- Icon buttons: `h-12 w-12` (48×48px)
- List items: `min-h-12` on history entries
- Close buttons: enlarged across all sheets/drawers
- Copy buttons in AyahSheet: enlarged from `p-1` to `p-2`
- Active feedback: `active:opacity-80 active:scale-[0.97] transition` on all buttons

**Files**: `AyahSheet.tsx`, `SettingsDrawer.tsx`, `page.tsx` (home)

### 6. Safe Area Insets
Applied `env(safe-area-inset-bottom)` to:
- Bottom nav bar
- SettingsDrawer
- SurahPicker
- DownloadManager
- Sheet content (globals.css)

## Design Decisions
- **Why Bottom Nav?** Places controls in the natural thumb reach zone.
- **Why Hide Chrome?** Reading is the primary activity; UI is secondary.
- **Why Bottom Sheet for all overlays?** Easier to dismiss with a downward swipe than reaching for close buttons at the top.
- **Why Abu Iyaad always included?** Opinionated choice for the target audience — users who download translations always get Abu Iyaad's translation alongside their chosen one.

## Files Changed
- `src/hooks/useImmersiveMode.ts` — **NEW**
- `src/components/reader/Reader.tsx` — top header → bottom nav + immersive mode
- `src/components/nav/SurahPicker.tsx` — top-anchored → bottom-anchored
- `src/components/offline/DownloadManager.tsx` — centered modal → bottom sheet + Abu Iyaad enforcement
- `src/components/ayah/AyahSheet.tsx` — touch target fixes
- `src/components/settings/SettingsDrawer.tsx` — touch target + safe area
- `src/app/page.tsx` — touch target fixes on home page
- `src/app/globals.css` — bottom-nav class, safe-area insets, sheet-handle tap area
