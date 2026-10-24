## Decisions

1. **Two sizes.** Ladder cost ~5× thumb+1280; OPFS ~3.9 GB vs ~0.78 GB at 3k; filmstrip 20 tiles ~0.31 MB @320 vs ~4.9 MB @1280 → keep thumb 320 + working 1280 (not one size).
2. **Pasteboard tier = 1280 only.** `IMAGE_TIERS = [1280]`; drop 640/2560 ladder/select/encode.
3. **Progressive:** placeholder → thumb → 1280 (existing display path, two sources).
4. **Worker resize:** `createImageBitmap` resize* when capping; OffscreenCanvas for EXIF only.
5. **Visible ∪ pool:** filmstrip window ∪ active-spread ids → `setVisibleAssetIds`; decode pool max 4; cancel on tier unsubscribe.
6. **UI tokens:** N/A — no chrome token change; keep PhotoThumb / filmstrip-placeholder / Status primitives.
7. **Baseline keep:** OPFS hydrate-before-encode, object-URL LRUs, worker priorities (PR before/after).

## Touch-set & Test Plan

- Files: `imageTiers`, `processPhoto`, `assetPool`, `tierCache*`, `ConnectedSpreadView`, `spreadPreviewKeys*`, Filmstrip visible union, `e2e/spread-view`; specs image-tiers, derived-cache, filmstrip, frame-budget.
- Reuse: worker pool, `ObjectUrlLru`, presets `thumb` / `tier-1280`.
- Tests: unit/PBT selectImageTier + resize; display without 640/2560; e2e tierCovers max 1280; priority unit locks.
- UI: skill `ui-review` before push (placeholder→thumb→preview smoke).
