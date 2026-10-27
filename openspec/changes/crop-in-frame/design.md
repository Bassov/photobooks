## Decisions

1. Core ops `setCrop {spreadId, frameId, crop}` and `resetCrop`; core clamps zoom to [1, 8], center to [0,1]. `clampCrop(frameRect, aspect, crop)` in `geometry/cropRect.ts` keeps the window inside the image; the editor stores effective values.
2. History: `coalesceKey` returns `crop:<frameId>` for crop ops, so a burst on one frame is one undo step.
3. Crop mode is an external store (`cropMode.ts`): dbl-click on a filled frame enters; Esc, or the frame emptying / changing asset, leaves.
4. `cropGesture.ts`: capture-phase document listeners (camera wheel-zoom untouched); drag pans, wheel zooms, arrows nudge (Shift ×10); rAF `transform` preview; commit on pointerup / wheel settle; deltas via `getBoundingClientRect/offsetWidth`.
5. `SpreadView`: active frame gets `data-crop-active`, unclipped, dim ghost image (`--crop` token), not draggable.
6. `desiredTiersForItems` scales the edge by `1 / max(crop.w, crop.h)`, so deeper zoom requests a bigger tier.
7. Fit & crop section uses `Slider` (`#c-slider`) + Button; skill `ui-review` on inspector + active frame.

## Touch-set & Test Plan

- Files: `src/core/geometry/cropRect.ts`, `src/core/ops/{crop,applyBookOp}.ts`, `src/core/index.ts`, `src/editor/{cropMode,cropGesture,bookHistory,spreadPreviewKeys,ConnectedSpreadView,InspectorStub,EditorShell}`, `src/render/SpreadView.{tsx,css}`, `e2e/crop-in-frame.spec.ts`, `e2e/perf/`.
- Reuse: `updateFrame`, `dispatchBookOp`, `getAssetAspectSnapshot`, `sourceCropRect`, `measureHandlerSync`.
- Tests: unit (clamp, ops, pan/zoom math, mode store, coalesce); PBT (window stays in [0,1]); e2e: empty (no section without crop mode), dbl-click + pan + reload keeps crop, wheel + arrows change crop, Reset, Esc; perf: 5 s pan, zero LoAF, `pointermove` p95 ≤ 2 ms.
