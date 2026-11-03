# layout-grids-parent-inherit-core

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item layout-grids-parent-inherit-core
Status: done

## Scope

- [ ] Grid inheritance re-align core (Designer Spec layout-grids-parent-inherit GP7, GP8; core only, the UI is `layout-grids-parent-inherit` G2): (a) editing a master grid field re-aligns every templated spread whose effective parent is that master and that does not override the changed field, placements kept, one history step (`setSpreadGrid`); (b) `setSpreadParent` re-aligns that spread; (c) `setBookGrid` re-aligns only spreads where the changed field's source is `book`; (d) new op `resetSpreadGridFields { spreadId, fields }` clears those overrides and re-aligns that spread (history label `Reset grid value`). Overlays keep following `effectiveGrid`.
- **Browser check:** `?fixture=painter&parent=a`, Masters mode, change Master A's column gutter — the 4-grid frames on all 40 spreads move (before: none did).
- **Perf:** a master grid edit re-resolves only spreads using that master; the 'editing the grid of a master used by 40 spreads' frame-budget gate also edits the gutter: zero LoAF.
- **Test:** core tests in `grid.test.ts` / `spreadLook.test.ts` (users only, overrides untouched, book-sourced only, reset one field + four margins, one undo step each); PBT in `layoutGrid.test.ts` (≥1000 runs): effective value = spread ?? master ?? book and its source matches.
- **Hard nos:** no UI change (`GridSection*`, `MasterSection`, `Inspector`, `uikit/` are G2).
- **Depends:** parent-spreads-inspector
