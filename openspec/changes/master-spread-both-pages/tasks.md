## Implementation

- [ ] 1. Core tests: a master with grid, a frame per page and a guide per page resolves on both pages of a two-page spread, and on the first and last single-page spreads with one page and no crash (`src/core/parentSpreads.pages.test.ts`).
- [ ] 2. `SpreadView` overlay layer above the highest spread frame; unit tests for the layer z-index and its absence in thumbs and without an overlay.
- [ ] 3. e2e on `?fixture=painter`: new master with 3 columns applied to a two-page spread and to page 1. Check overlay page count, columns per page, page-2 column offset, and that each page's column centre hits the grid overlay.

## Manual test scenarios

1. Painter fixture: Masters → New master → Columns 3 → Pages → spread 2–3 → Master = new master → Grid on. Columns show on both pages, over the frames.
2. Same master on page 1 (single page): columns on the one page, no second page.
