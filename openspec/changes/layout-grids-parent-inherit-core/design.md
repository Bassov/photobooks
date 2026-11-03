## Decisions

1. One private helper in `grid.ts`, `editGridOverride(book, id, edit)`, backs `setSpreadGrid`, `resetSpreadGrid` and the new `resetSpreadGridFields`: it edits a spread's or a master's override, records the fields whose stored override changed and re-aligns the spread itself or, for a master id, the spreads whose effective parent (`spreadParent`, includes the book default) is that master and that do not override a changed field. No change → the same book (no step).
2. `setBookGrid` re-aligns spreads where a changed field has source `book` (new `gridFieldSource` in `layoutGrid.ts`, the rule `effectiveGrid` reports).
3. `realign` is exported; `setSpreadParent` re-aligns its spread on a change. `applyTemplate` keeps unchanged spreads by reference, so untouched spreads stay `===` (GP8).
4. `resetSpreadGridFields` deletes the listed fields; empty `margins` / `layoutGrid` go. Linking the four margins is the caller's job (G2).

## Touch-set & Test Plan

| Path                                   | Why                   |
| -------------------------------------- | --------------------- |
| `src/core/ops/grid.ts`                 | GP7 a/c/d             |
| `src/core/grid/layoutGrid.ts`          | `gridFieldSource`     |
| `src/core/ops/spreadLook.ts`           | GP7 b                 |
| `src/core/ops/applyBookOp.ts`          | new op                |
| `src/editor/bookHistory.ts`            | label                 |
| `e2e/parent-spreads-inspector.spec.ts` | GP8 gate edits gutter |

- Unit: `grid.test.ts` (master users only; other master / None / override untouched; book-sourced only; reset one field / four margins; painter 40), `spreadLook.test.ts`, history labels. PBT `layoutGrid.test.ts` ≥1000 runs.
- e2e: 40-spread master grid gate, zero LoAF, frames move on all 40.
