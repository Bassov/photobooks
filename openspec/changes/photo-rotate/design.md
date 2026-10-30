## Decisions

1. No schema change: `crop.quarterTurns` / `straightenDeg` exist; `setCrop` now stores them (normalized, zero absent); `resetCrop`/`setFit` keep them.
2. Cover: `shownCropRect` inflates the window to the rotated frame's bounding box and clamps the center (fill only); `clampCrop` carries rotation. Pan maps the drag through the straighten angle.
3. Painter: unrotated frames keep the percent box; turned photos use a px box + `rotate(q*90+θ) translate` on the img inside `[data-photo-layer]`, so rAF previews (`translate`/`scale`/straighten) never overwrite the layout transform.
4. Straighten preview = exact similarity transform (`straightenPreviewTransform`) in rAF on the layer, one `setCrop` on slider end; handler measured as `straighten`.
5. Keys `,` / `.` (free; `[` `]` are panel toggles).

## Touch-set & Test Plan

`src/core/geometry/cropRect.ts`, `ops/crop.ts`, `src/render/{photoLayout,SpreadView}`, `src/editor/{photoRotate,PhotoRotateSection,installEditorRotateKeys,cropMath,cropGesture,FitCropSection,Inspector,EditorFrame}`, icons. PBT: cover invariant, preview transform. Unit: ops, painter, section, keys. e2e: turn, straighten covered, reload, 5 s perf.
