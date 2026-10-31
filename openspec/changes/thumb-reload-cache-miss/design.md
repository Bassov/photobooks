## Decisions

1. `ensureThumb` (`thumbCache.ts`, runs on every filmstrip mount) awaits `decodeThumbOnCacheMiss` on a DerivedCache miss inside the same `hydrateInflight` entry: no double-queue on remount; reset aborts it.
2. Decode via `processAsset` (worker, thumb320 only). Now-set ids get `visible` (now lane). Others get `prefetch`: the pool defers off-now JPEG/HEIC and promotes them at `visible` when they enter now (the scrolled-in tail), so no off-now full-original decode is queued.
3. File: `getAssetSource`, else the registered `AssetSource` for `sourceRootId` + `relativePath` (only roots registered after a granted restore; no permission prompt), then `retainAssetSource`. Unresolved → skip.
4. Result → `setThumbUrl(…, cacheKey)` (paced publish + cache put) and `restoreAspectFromDecode` for placeholder dims. Failure publishes nothing; a later mount retries.

## Touch-set & Test Plan

| File                                         | Why                                                    |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/editor/thumbCache.ts`                   | miss branch                                            |
| `src/editor/thumbMissDecode.ts`              | new: File + pool decode                                |
| `src/editor/previewAspect.ts`                | `restoreAspectFromDecode`                              |
| `src/photo/assetPool.ts`                     | `isNowAssetId`                                         |
| `src/editor/thumbMissDecode.test.ts`         | unit                                                   |
| `e2e/thumb-reload-cache-miss.spec.ts`        | e2e repro                                              |
| `docs/roadmap/P1/thumb-reload-cache-miss.md` | plan/roadmap docs (+ `docs/roadmap.md`, change folder) |

- Reuse: `processAsset`, `getRegisteredAssetSource`, `setThumbUrl`, `applyDims`.
- Tests: unit via `ensureThumb` + real pool + `mockWorkerSuccess` (retained, registry, none, deferred, failure); new e2e; `open-save` bulk reload; frame-budget 1000-photo scroll.
