## Decisions

1. Frame gains optional `fit: 'fill'|'fit'` (absent = fill). `sourceCropRect` takes `fit`; fit uses the larger base window (>1 on one axis), centered, so the existing `imageCropBox` letterboxes it. An axis whose window is ≥1 is pinned centered; `clampCrop` threads `fit`.
2. New op `setFit` sets fit and resets crop to cover (one history step). Pan % = (center−0.5)×200 through `clampCrop`; slider writes zoom 1–4 via `setCrop`.
3. Section renders for any selected filled frame (not only crop mode); Crop button toggles `enterCropMode`/`exitCropMode`. Section keeps `data-crop-keep`.
4. Local react-aria Slider/NumberField in `FitCropSection.tsx` (kit look, `.sl-*` CSS in `EditorShell.css`); no `src/ui` primitive (that is M4 `ui-primitives-forms`). dbl-click resets, ↑/↓ while hovered.
5. Crop overlay via CSS on `[data-crop-active]`: `2px solid var(--crop)`, tag `Crop · N%` on FIELD; selection `::after` and handles hidden meanwhile.

## Touch-set & Test Plan

- Files: `src/core/{schema,geometry/cropRect,geometry/resolveSpread,ops/crop,ops/applyBookOp}`, `src/editor/{Inspector,FitCropSection,cropMath,cropGesture,ConnectedSpreadView,EditorShell.css}`, `src/render/{SpreadView.tsx,SpreadView.css}`, specs book-core/editor-shell.
- Reuse: `SegmentedControl`, `Button`, `clampCrop`, `setCrop`, crop mode store.
- Tests: unit for fit rect + setFit; PBT clamp stays inside; Inspector component tests (section, fit, reset disabled, Done); e2e: none selected (no section), photo selected (section), Crop/Done/Esc. `ui-review` on Inspector.
