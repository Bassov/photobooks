## Decisions

1. Ladder `[1280, 2560]`. `selectImageTier(cssPx, dpr)` picks the smallest step ≥ `cssPx × dpr`, else 2560. `desiredTiersForItems` folds zoom and crop into `cssPx`, so `ConnectedSpreadView` is unchanged. It now measures the whole drawn image (`frame / visible fraction` per axis). The old max-fraction rule took the frame's edge for a cover crop and under-sized a landscape photo in a portrait frame.
2. `capTierToSource` keeps 1280 for a known source ≤ 1280 px (`getAssetPixelSizeSnapshot`; unknown → no cap). The worker never upscales, so 2560 on a 2000 px source yields 2000.
3. `holdDisplayTiers` also requests 1280 under a 2560 tier (fast first upgrade). 2560 jobs use `prefetch` priority (below `zoom`). The last unsubscribe already aborts the job.
4. Drag hold (`holdDragTier` / `releaseDragTier`): an asset dragstart holds 1280, a hovered frame raises it to that frame's tier (rect from `hitTestDrop`), and session end releases it. The decoded URL stays shown, so the dropped frame paints it at once.

## Touch-set & Test Plan

| File                                    | Why                                    |
| --------------------------------------- | -------------------------------------- |
| `src/photo/imageTiers.ts`               | ladder, choice, source cap             |
| `src/photo/tierCache.ts`                | 2560 job priority                      |
| `src/editor/holdDisplayTiers.ts`        | cap, 1280 step, drag hold              |
| `src/editor/galleryDrop.ts`             | drag hold on dragstart / hover / end   |
| `src/editor/dropTargets.ts`             | `hitTestDrop` returns the target rect  |
| `src/editor/spreadPreviewKeys.ts`       | drawn-image long edge for the need     |
| `e2e/editor-hidpi-photos.spec.ts` (new) | DPR 2 / DPR 1 widths, drop never blank |
| `e2e/spread-view.spec.ts`               | zoom tier checks accept 2560           |
| `openspec/specs/image-tiers/spec.md`    | ladder contract                        |
| `openspec/specs/derived-cache/spec.md`  | 2560 preset                            |
| `openspec/specs/frame-budget/spec.md`   | zoom scenario accepts 2560             |

- Unit: `imageTiers` (Done-when cases plus PBT), `holdDisplayTiers` (cap, step, drag hold), `tierJobPriority`. No gate config edits.
