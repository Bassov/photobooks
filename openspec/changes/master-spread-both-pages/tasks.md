## Implementation

- [x] 1. Core tests: a master with grid, a frame per page and a guide per page resolves on both pages of a two-page spread, and on the first and last single-page spreads with one page and no crash (`src/core/parentSpreads.pages.test.ts`, d16eb251).
- [x] 2. `SpreadView` overlay layer above the highest spread frame; unit tests for the layer z-index and its absence in thumbs and without an overlay (`src/render/SpreadView.test.tsx`, d16eb251).
- [x] 3. e2e on `?fixture=painter`: new master with 3 columns applied to a two-page spread and to page 1. Checks overlay page count, columns per page and the page-2 column offset. At a point in each page's first column that lies over a frame, the grid column paints above the frame. Fails with the layer at z 0 (page 2 `gridOnTop` false), passes with the fix (`e2e/master-spread-both-pages.spec.ts`, d16eb251).

## Manual test scenarios

1. Painter fixture: Masters → New master → Columns 3 → Pages → spread 2–3 → Master = new master → Grid on. Columns show on both pages, over the frames.
2. Same master on page 1 (single page): columns on the one page, no second page.

- 1: problem (harness, not reached). `pnpm agent manual-qa` times out on `start-session`: the welcome header intercepts the click (known harness blocker, also on main). Evidence instead: `e2e/master-spread-both-pages.spec.ts` passes. On `painter-spread-1` it finds 2 grid pages × 3 columns; on each page the grid column paints above the frame under the probe point; page 2's columns sit right of the spread midline.
- 2: problem (harness, not reached). Same blocker. Evidence instead: the same spec. `painter-spread-0` has 1 grid page with 3 columns, and the grid column is on top.
