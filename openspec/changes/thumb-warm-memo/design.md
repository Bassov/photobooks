## Decisions

1. **Key per record revision.** `cacheKeyFromRecord` (`src/assets/cacheKey.ts`) memoizes `tryCacheKeyFromAsset` in a `WeakMap` keyed by the record (`null` = incomplete). Book asset records are replaced, never mutated, so a new revision misses. `getAssetCacheKey` uses it when only the book record exists; the import-time merge path keeps the digest memo.
2. **Pending thumb index.** `PendingJobIndex` (`src/photo/pendingJobIndex.ts`) refcounts assetIds over a job `Set` (idempotent per job). `assetPool` adds thumb320 jobs on enqueue and removes them on take-aborted, leave-now cancel, settle and reset. `hasPendingThumbDecode` = deferred map ∪ index, O(1).
3. **Warm `settled` by asset.** `Map<assetId, cacheKey>` replaces the `assetId\ncacheKey` string `Set`, so no scan step builds a string.
4. **Callers.** `thumbCache`, `holdDisplayTiers`, `importPhotos`, `FilmstripItem` and `thumbMissDecode` inherit the cheap path; exceptions go in the PR body.
5. **Seam.** Warm stats add `passCount` / `passTotalMs`; `e2e/thumb-warm-slice.spec.ts` logs the per-pass mean.

## Touch-set & Test Plan

| File                                | Why                              |
| ----------------------------------- | -------------------------------- |
| `src/assets/cacheKey.ts`            | record memo                      |
| `src/editor/bookStore.ts`           | one branch in `getAssetCacheKey` |
| `src/photo/pendingJobIndex.ts`      | new index                        |
| `src/photo/assetPool.ts`            | keep index; cheap lookup         |
| `src/editor/thumbBackgroundWarm.ts` | settled map, pass stats          |
| `e2e/thumb-warm-slice.spec.ts`      | per-pass log                     |
| `e2e/perf/perfFixture.ts`           | stats type                       |

- Reuse: digest memo; `ManualWorker` in `assetPool.inflight.test.ts`.
- Unit: memo hit / revision miss / incomplete (`cacheKey.memo.test.ts`); pending → live → patched key (`bookStore.test.ts`); index refcount (`pendingJobIndex.test.ts`); enqueue / finish / error / cancel / abort / reset (`assetPool.inflight.test.ts`); pass stats (`thumbBackgroundWarm.test.ts`).
- e2e: `thumb-warm-slice` numbers; existing thumb specs.
