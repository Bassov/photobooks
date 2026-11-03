## Implementation

- [x] 1. Kit: `v7.tsx` `Field` / `GridFields` source + ↺; `context-inspector.tsx` SpreadGridSection per-key Custom, hint, `Use book`; delete `sections.tsx` GridSection / GRID_FIELDS / SRC. Evidence: `pnpm uikit:qa:quick` 279/279 incl. new smoke "layout-grids-parent-inherit GP2/GP3".
- [x] 2. Prod: `GridFields.tsx` from MasterSection; MasterSection uses it (no visual change, `master-field-*` kept). Evidence: `MasterSection.test.tsx` unchanged + `e2e/parent-spreads-inspector.spec.ts` MS2 rects green.
- [x] 3. Prod: `GridSection.tsx` Custom with sources, ↺ (`resetSpreadGridFields`), link (writes only margins ≠ T), hint; remove `BookGridSection` / `GridFieldInput` / `FIELDS` / `scope`; `GridSection.css` cleanup + `data-source` / `.insp-grid-reset`.
- [x] 4. Unit tests `GridSection.test.tsx`, `GridFields.test.tsx`, `inspectorModel.test.ts` (GP2–GP5).
- [x] 5. e2e: new `layout-grids-parent-inherit.spec.ts` (GP1 rects, browser check); update `layout-grids-settings.spec.ts`, `design-r2-layout-picker.spec.ts`, `kit10-grid-snap.spec.ts`.

## Manual test scenarios

1. `?fixture=painter&parent=a`: select a spread → Grid shows `Use master` + summary; Custom shows 8 grey fields and the hint `Grey values follow Master A.`
2. Set G to 8 → G dark 600 + ↺; ↺ restores the master gutter and Custom stays open; Undo label `Reset grid value`.
3. Masters tab → Master A columns 4 → the spread with the gutter override keeps G 8, the others follow.
