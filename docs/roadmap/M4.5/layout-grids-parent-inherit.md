# layout-grids-parent-inherit

Tag: feature
Milestone: M4.5
Title: grids on parent spreads

## Scope

- [ ] Grid section while editing a parent: margins, columns, rows, gutters set on the parent; spreads using it inherit them
- [ ] Spread overrides from `layout-grids-settings` now apply on top of the parent; the grid section shows each value's source (book / parent / spread) with "Reset to parent"
- [ ] Assigning a parent or editing its grid re-aligns template-driven spreads using it (placements kept, one history step)
- **Perf:** a parent grid edit re-resolves only spreads using that parent. Gate: edit the grid of a parent used by 40 spreads — zero LoAF.
- **Browser check:** give a parent a 3-column grid and apply it to five spreads — their overlays and template frames follow; override one spread's gutter; switch the parent to 4 columns — the inheriting spreads update and the override keeps its gutter.
- **UI ref:** `uikit#/feature/layout-grids-parent-inherit`
- **UI kit:** `uikit/src/features/m45.tsx:240-243` (`layout-grids-parent-inherit` demo + notes), `UI ref: uikit#/feature/layout-grids-parent-inherit` — parent grid inherit + reset
