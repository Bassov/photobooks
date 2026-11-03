## Implementation

- [x] 1. Pass stats seam (`passCount` / `passTotalMs`) and per-pass log in `e2e/thumb-warm-slice.spec.ts`; before numbers taken on the unchanged lane (`thumbBackgroundWarm.test.ts` sliced-pass test)
- [x] 2. `cacheKeyFromRecord` per-revision memo and the `getAssetCacheKey` steady-state branch (`cacheKey.memo.test.ts`, `bookStore.test.ts`)
- [x] 3. `PendingJobIndex` kept by `assetPool`; `hasPendingThumbDecode` reads it (`pendingJobIndex.test.ts`, `assetPool.inflight.test.ts` "pending thumb decodes")
- [x] 4. Warm `settled` keyed by asset (`thumbBackgroundWarm.test.ts`)

## Manual test scenarios

N/A: no UI change; perf evidence comes from `e2e/thumb-warm-slice.spec.ts` and `src/editor/folderImportPerf.test.ts`.
