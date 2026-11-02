## Implementation

- [x] 1. Ladder 1280 → 2560: `selectImageTier(cssPx, dpr)` + `capTierToSource` in `src/photo/imageTiers.ts` with unit / PBT tests (`src/photo/imageTiers.test.ts`).
- [x] 2. `tierCache`: tier jobs above 1280 run at `prefetch` priority (`tierJobPriority`, `src/photo/tierCache.test.ts`).
- [x] 3. `holdDisplayTiers`: source cap, 1280 stepping stone under a higher covering tier, `holdDragTier` / `releaseDragTier` (`src/editor/holdDisplayTiers.test.ts`); `desiredTiersForItems` sizes the whole drawn image (`src/editor/spreadPreviewKeys.test.ts`).
- [x] 4. `galleryDrop` + `dropTargets`: asset drag holds 1280 on dragstart and the hovered frame's tier, releases on session end (`src/editor/Pasteboard.drop.test.tsx`).
- [x] 5. e2e `e2e/editor-hidpi-photos.spec.ts`: DPR 2 natural 2560 for a 1016 CSS px long edge, DPR 1 stays 1280, no `naturalWidth 0` sample after the drop; `e2e/spread-view.spec.ts` zoom tier checks accept 2560 (frame-budget gates 9/9 with `--workers=1`).
- [x] 6. Specs `image-tiers`, `derived-cache`, `frame-budget` updated to the 1280 / 2560 ladder (change deltas).

## Manual test scenarios

1. DPR 2: drop a filmstrip photo on a full-bleed page; the photo turns sharp with no blank frame, and the image natural width is ≥ 2× its CSS width.
2. DPR 1: the same drop keeps the 1280 preview.
