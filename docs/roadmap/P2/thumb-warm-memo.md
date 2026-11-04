# thumb-warm-memo

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item thumb-warm-memo
Status: done

## Scope

- [ ] The background thumb warm pass stops rescanning every asset at full cost on each finished job: memoize the identity cache key per asset revision (invalidated when the asset record changes) and keep a pending-thumb index maintained by the decode queue instead of scanning it (follow-up idea from #384)
- **Callers:** every caller of `getAssetCacheKey` / `hasPendingThumbDecode` (`thumbBackgroundWarm.ts`, `thumbCache.ts`, `holdDisplayTiers.ts`, `importPhotos.ts`, `FilmstripItem.tsx`, `thumbMissDecode.ts`) uses the cheap path or is listed in the PR body as left out with a reason
- **Perf:** per-pass warm CPU at 1000 photos (2× throttle, the #384 measurement) drops by ≥50 %; warm completion time at 1000 photos and the first open of ~3200 new files (~2.4 s) do not get worse; `PERF_BUDGETS` unchanged; heavy work stays sliced, no main-thread stalls
- **Browser check:** `e2e/thumb-warm-slice.spec.ts` logs per-pass CPU and warm completion before → after (numbers in the PR body)
- **Test:** unit tests for memo hit, invalidation on revision change, and pending-index add/remove on enqueue / finish / cancel / error; existing thumb / perf tests and e2e green
- **Hard nos:** no edits to `src/core`, `src/render`, `uikit/`; `bookStore.ts` minimal diff; no backward compat needed for the cache key format (Owner 2026-11-02)
