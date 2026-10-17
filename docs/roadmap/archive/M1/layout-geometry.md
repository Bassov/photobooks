# layout-geometry

Tag: prep
Milestone: M1
Title: templates, resolver, ops

## Scope

- [x] Templates as frame generators aligned to the layout grid: full-bleed spread, one per page, 2-up, 4-grid
- [x] `resolveSpread` → resolved items with source crop rect; derived page cut lines; memoized by spread reference
- [x] Pure ops: add to / remove from gallery (cascades placements), place, replace, unplace, swap, apply template, add / remove / move spread
- [x] Selectors: placement count per asset, unplaced assets
- [x] PBT for geometry and op invariants; `pnpm bench` budgets for resolve, ops and selectors on a 40-spread / 1000-asset book
