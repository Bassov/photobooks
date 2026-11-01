## Decisions

1. `hydrateGalleryThumbs()` in `src/editor/thumbCache.ts`: one background pass over the gallery, started by `startFolderRescan` (`photoRootSession.ts`) right after the manifest-first enqueue. A new pass or `resetThumbCache` cancels the running one (generation counter).
2. Each batch takes up to 8 ids nearest the current filmstrip window (window first, then alternating outward; recomputed per batch). Skips ids already hot, with a started mount read, or without a cache key (a queued mount read drops on unmount, so the pass still reads it).
3. A batch is 8 parallel `DerivedCache.get` reads; hits use the mount path's store (`restoreAspectFromPreview` + `storeThumb`); misses stay with the mount path. `setTimeout(0)` yield between batches.
4. A hit past the byte budget ends the pass (no eviction); an asset removed mid-read is dropped.
5. Seam `getThumbBulkHydrateStatsForTests()` (`state`, `hydrated`, `missed`, `ms`) on `window.__photobooksThumbs`.

## Touch-set & Test Plan

- Files: `src/editor/thumbCache.ts`, `src/editor/photoRootSession.ts` (one call), `src/editor/projectSession.ts` (seam), `e2e/thumb-bulk-hydrate.spec.ts` (incl. its `frame-budget gates` describe), `e2e/fixtures/filmstripFling.ts` (fling probe moved from `e2e/thumb-hot-cache.spec.ts`, import only there). No gate config edit. Scratch `e2e/zz-hydrate-measure.spec.ts` is deleted before commit.
- Reuse: memory DerivedCache, `browserFlingAndProbe`, perf fixture helpers.
- Unit: `thumbCache.test.ts` (order, budget, skip, cancel, removal); `folderRescan.test.ts` (restore hydrates before `scanRoot` resolves).
- E2E: Done-when fling probe; perf: reload then immediate scroll, 0 LoAF.
