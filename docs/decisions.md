# Implementation Decisions

Date: February 12, 2026

## 1) Scope for this implementation pass
Decision: Implement Phase 1 fully and a thin Phase 2 foundation (typed manifest contract, loader, and generation script), while deferring the full custom renderer and protobuf encoding pipeline.
Reason: This keeps the codebase stable while unblocking route canonicalization, preference correctness, and type-safe state synchronization.

## 2) Preference source of truth across SSR/CSR
Decision: Use cookie-backed settings as SSR source of truth, mirror to localStorage on the client, and reconcile via Zustand hydration.
Reason: It guarantees deterministic server-derived reader routes and removes localStorage-only first render drift.

## 3) Route canonicalization strategy
Decision: Use `/{surah}/{ayah?}/r/m:{mCode}/t:{tCode}` as canonical and keep bare routes (`/{surah}` and `/{surah}/{ayah}`) via redirect.
Reason: URLs now always encode mushaf + translation preference while preserving fast manual navigation.

## 4) Redirect placement
Decision: Perform bare-route redirects in the Surah page server component rather than middleware.
Reason: The route already validates params and resolves chapter/page boundaries, so redirect logic remains close to reader parsing without introducing edge middleware complexity.

## 5) Zustand architecture
Decision: Use a vanilla Zustand store (`createStore`) bound via `useStore` in context instead of a global hook-only store.
Reason: This follows the advanced TypeScript guidance for bounded stores and allows clean injection of server-initialized settings into React tree context.

## 6) ArkType usage boundaries
Decision: Use ArkType for runtime validation at trust boundaries (settings snapshots and route token parsing), with explicit normalization after validation.
Reason: It preserves strong runtime safety without overcomplicating internal logic where TypeScript static types are already sufficient.

## 7) First-paint mismatch policy (current engine constraints)
Decision: Gate mushaf rendering behind hydration and exact route-settings match, showing skeleton until synchronized.
Reason: With the current `open-quran-view` runtime font loader, strict no-fallback-font rendering is approximated by delaying render until preference alignment.

## 8) Mushaf renderer compatibility mapping
Decision: Keep `open-quran-view` for now and map Quran.com mushaf codes into supported renderer layouts (`hafs-v2`, `hafs-v4`, `hafs-unicode`).
Reason: This enables expanded preference model immediately while preserving existing rendering behavior until full in-repo renderer lands.

## 9) Bun engine adoption
Decision: Standardize scripts around Bun (`bunx --bun ...`) and add `packageManager`/`engines` metadata for Bun.
Reason: Ensures consistent runtime execution path and aligns build/dev/lint flows with Bun-first engine policy.

## 10) Asset generation bootstrap
Decision: Add `scripts/generate-mushaf-assets.ts` that generates manifest and optional sample assets (`--seed-sample`) now.
Reason: This gives a concrete, runnable contract for Phase 2 without committing to incomplete large data downloads during this pass.
