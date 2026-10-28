## Implementation

- [x] 1. Core grid model: partial spread override schema, `effectiveGrid`/clamp — `src/core/ops/grid.test.ts`
- [x] 2. Ops `setBookGrid` / `setSpreadGrid` / `resetSpreadGrid`, template re-align, history includes book grid — `grid.test.ts`, `GridSection.test.tsx` (undo)
- [x] 3. `GridSection` (summary, 8 quiet fields, BOOK|SPREAD labels, Reset, note, toggle) — `GridSection.test.tsx`
- [x] 4. Inspector Spread | Book tabs — `Inspector.grid.test.tsx`
- [x] 5. Editor-only `GridOverlay` (mirrored pages) via `SpreadView` overlay slot — `gridOverlayModel.test.ts`, `Inspector.grid.test.tsx`
- [x] 6. e2e: Book → Columns → summary; Spread override → SPREAD + Reset — `e2e/layout-grids-settings.spec.ts`

## Manual test scenarios

1. Book tab → Layout grid → Columns 12, Inside 25 → summary `12×2`; eye on → overlay shows 12 bands, facing pages mirrored.
2. Spread tab → Columns 3 → SPREAD label, Reset enabled → Reset → BOOK label, Reset disabled.
