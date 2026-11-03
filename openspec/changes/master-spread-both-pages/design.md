## Decisions

1. **Root cause: paint order.** Core resolvers are page-agnostic; `resolveLayoutGrid` returns both pages. The canvas paints frames with `z-index = frame.z`, the overlay with none, so a page under a `z ≥ 1` frame (right frame of a 2-up) hides the grid. Fix in the shared painter: `SpreadView` wraps `overlay` in a `spread-view-overlay` layer (`absolute`, `inset: 0`, `pointer-events: none`) at z = max spread-frame `z` + 1 (≥ 1). Crop-active frames (`z + 1000`) and the group box (999) stay above; guide hit strips keep `pointer-events: auto`; no layer without `overlay` (thumb, Preview).
2. **Core unchanged, locked by tests**: master grid, frames and guides on two-page, first and last spreads.
3. Callers are listed in the PR body.
4. UI: no new tokens or primitives (z-order only); `ui-review` on the e2e measurements.

## Touch-set & Test Plan

| Path                                   | Why               |
| -------------------------------------- | ----------------- |
| `src/render/SpreadView.tsx`            | overlay layer     |
| `src/render/SpreadView.test.tsx`       | layer z vs frames |
| `src/core/parentSpreads.pages.test.ts` | core lock-ins     |
| `e2e/master-spread-both-pages.spec.ts` | DOM lock-ins      |

- Reuse: core fixtures, `?fixture=painter` (4-grid frames `z` 0–3).
- e2e hit test: per page, `document.elementsFromPoint` at a column centre; the grid column must come before every frame. Columns are `pointer-events: none`, so the test sets `pointer-events: auto` on the overlay SVG only, for the measurement. Also checks page count, columns per page and the page-2 column offset. No screenshots.
