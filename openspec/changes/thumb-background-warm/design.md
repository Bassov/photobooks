## Decisions

1. Warm lane is its own module `src/editor/thumbBackgroundWarm.ts`, installed from `EditorShell`. It keeps ≤ cap jobs in the pool: 1 while the filmstrip scrolls or a canvas gesture is active, else the idle cap with pool backoff. Passes run via `scheduleWhenNowEmpty`; paused while an import runs.
2. Order (pure `orderWarmCandidates`): book-used first, then distance from the published filmstrip window; equal distance → side ahead of the last scroll direction first.
3. Candidates need a DerivedCache identity key; stored thumbs are skipped via the new `DerivedCache.has`. Import-deferred JPEG/HEIC entries are promoted onto the background lane (the import owner still publishes + seeds); others encode via `processAsset({ backgroundWarm: true })` → `setThumbUrl(…, cacheKey)`.
4. Pool: `backgroundWarm` jobs bypass the lazy defer; while decode scroll-quiet one warm job may start if none is in flight. Export the existing effective slot limit.
5. `filmstripVisibleSync`: during scroll publish at most every 100 ms, extended in the scroll direction by velocity × 200 ms (≤ one window); exact window on quiet end. It also publishes the window to `filmstripWindow.ts`. `Filmstrip.tsx` gains one argument.
6. Security: no new FSA / worker / blob surface; the lane reuses `sourceFileFor` and the existing pool workers.

## Touch-set & Test Plan

- Files: `src/editor/{thumbBackgroundWarm,filmstripWindow,filmstripVisibleSync,thumbMissDecode,EditorShell,Filmstrip,projectSession}`, `src/photo/assetPool.ts`, `src/assets/derivedCache/{types,opfs,memory}.ts`; spec deltas filmstrip / image-tiers / asset-source / photo-card (same ban). Seam `__photobooksThumbs` lives in `projectSession.ts`.
- Reuse: `scheduleWhenNowEmpty`, `sourceFileFor`, `setThumbUrl`, `DECODE_POOL_CAP_IDLE`.
- Tests: unit (ordering, idle-only, scroll cap, skip cached, no retry, pool, throttle, `has`); e2e `e2e/thumb-background-warm.spec.ts`.
