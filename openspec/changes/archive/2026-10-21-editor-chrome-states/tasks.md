## Implementation

- [x] 1. Filmstrip status strip on `Status` + `ProgressBar`
- [x] 2. Placed chip → `Badge`; filmstrip empty → `EmptyState`; static placeholders
- [x] 3. Import errors → error `Toast` via shell queue + `importErrorToast`; Show files → editor `Status`
- [x] 4. Editor live line → `Status`; canvas CSS on semantic tokens; drop-hover one attribute
- [x] 5. Unit + e2e; drag-place-replace + filmstrip import LoAF; roadmap ticks
- [x] 6. Manual QA + ui-review

## Manual test scenarios

1. OK Empty editor: filmstrip EmptyState copy readable; no page-level H/V scroll.
2. OK Import 100+ photos with one failing file: ProgressBar/status during import; error Toast lists failure; gallery keeps good files.
3. OK Drag-place and swap: drop-target uses one attribute; Placed Badge on filmstrip; selection/focus rings distinct; placeholders static.

### ui-review

- Design system / a11y / layout smoke: pass — Status/ProgressBar/Badge/EmptyState/Toast + canvas tokens; empty geometry + LoAF e2e green. Anti-slop N/A (editor chrome).
