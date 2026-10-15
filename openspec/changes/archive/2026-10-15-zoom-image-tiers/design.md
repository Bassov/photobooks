# Design

## Context

See proposal.md. `SpreadView` paints `previewUrlFor` and must not import `photo` or `editor` (`render-no-platform`). `assetPool.processAsset` already takes `maxEdge` and `AbortSignal`. `thumbCache` publishes one object URL per frame. Committed zoom updates only after the gesture settles.

## Goals / Non-Goals

**Goals:**

- Covering tier from committed zoom only; decode-then-swap in the editor
- One in-flight encode per `(assetId, tier)`, shared by every frame

**Non-Goals:**

- A gesture-active flag beyond committed zoom
- Moving filmstrip thumbs onto this cache

## Decisions

1. **Pure ladder in `src/photo/imageTiers.ts`.** `selectImageTier(onScreenLongEdgePx, dpr)` picks the smallest of 320, 640, 1280, 2560 that is `>= ceil(onScreenLongEdgePx * dpr)`, else 2560. On-screen long edge is the frame's laid-out CSS px at zoom 1 (`rect mm * SPREAD_PX_PER_MM`) times committed zoom. Alternatives: continuous sizes (unbounded cache) or reading live zoom (re-renders per wheel).

2. **Session files in `src/photo/assetSources.ts`.** `retainAssetSource(assetId, file)` / `getAssetSource`. `importPhotos` retains the `File` after enqueue. `loadPainterFixture` retains four tiny PNG `File`s for `painter-a`…`d` with `cover: true` so the worker can upscale them to the tier. The book document is unchanged. Not stored in `bookStore`.

3. **`src/photo/tierCache.ts` owns the LRU.** Key `assetId + ":" + tier`, capacity 48, reuse `ObjectUrlLru`. `requestTier` enqueues `processAsset` once per key. Publish at most one URL per `requestAnimationFrame`. Subscribers are per key. Eviction revokes. Tier aborts use a controller separate from `abortByAsset` so cancelling a tier cannot abort import.

4. **Priority `zoom` on the existing pool.** Rank: `visible` > `zoom` > `prefetch` > `background`. Filmstrip import stays `prefetch` / `visible`. No new worker.

5. **Editor swaps; render stays presentational.** `ConnectedSpreadView` subscribes to committed zoom and to the tier URL for each placed asset on that spread. It calls `requestTier` on miss. A displayed URL (fixture SVG or previous tier) stays until `HTMLImageElement.decode()` resolves, then `previewUrlFor` returns it. `SpreadView` gains optional `tierFor` and sets `data-tier` on the image. It does not import `photo`. Zoom does not write `bookStore.previewUrls`.

6. **Unmount cancels only that tier wait.** Dropping the last subscriber for a key aborts that tier's controller. Import controllers stay.

## Risks / Trade-offs

- [2560 decode under CPU throttle records LoAF] → one decode and one URL publish per frame; ladder stops at 2560
- [Whole-book zoom mounts 40 spreads] → jobs dedupe to four fixture assets
- [Fixture SVG until the first tier decodes] → no placeholder flash; `data-tier` updates only after swap

## Security

Session `File`s and preview `ArrayBuffer`s are posted only to the existing same-origin module worker (`photo.worker.ts`). Object URLs are revoked on eviction and on `resetTierCache`. Files are absent from `serializeBook`. No new headers, CSP, or dependencies.

## Touch-set

- `src/photo/imageTiers.ts`, `src/photo/assetSources.ts`, `src/photo/tierCache.ts`, `src/photo/assetPool.ts`
- `src/editor/importPhotos.ts`, `src/editor/ConnectedSpreadView.tsx`, `src/editor/bookStore.ts` (`loadPainterFixture` only)
- `src/render/SpreadView.tsx` (`tierFor` / `data-tier` only)
- `e2e/spread-view.spec.ts`
- `scripts/stryker-diff.mjs`, `stryker.config.json` (add the new photo modules)

## Tests and UI

Public API: `selectImageTier` (unit + fast-check), `tierCache` eviction and one-URL-per-frame, `assetPool` rank of `zoom` below `visible`, and a tier abort that still lets `runImportBatch` finish. Reuse `src/photo/photo.test-helpers.ts`; do not add another shared fixture. `SpreadView` tests the `data-tier` attribute. Decode-then-swap is tested through `ConnectedSpreadView` (mock `HTMLImageElement.decode`).

E2E: empty fixture frame stays a placeholder; after zoom to ≥400% and settle, a filled frame's `data-tier` covers its on-screen size and the image stays present. That path calls `assertDocumentFitsViewport` and `assertNamedScrollport` for `pasteboard-scroll`. The existing continuous-zoom scenario keeps zero LoAF and wheel p95, and asserts a tier change inside the window.

Skill `ui-review` (layout smoke included) runs before push.
