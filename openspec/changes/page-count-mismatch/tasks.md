## Implementation

- [x] 1. `pagesOf` = 2 × (spreads − 1) (0 / 1 below 2) and `spreadsForPages`; `setPageCount` targets it; unit + PBT (`src/core/pages.test.ts`, `src/core/pages.pbt.test.ts`).
- [x] 2. `BookTile` caption / aria-label and `bookSpineWidthMm` read `pagesOf`; site drops `sitePageCount` for `pagesOf`; count text via `pagesText` (`1 page`) in the top bar, library caption, site meta and catalog card (`src/editor/BookTile.test.tsx`, `src/site/siteModel.test.ts`).
- [x] 3. Update unit / e2e expectations that encoded 2 × spreads (top bar, Book settings, tile, spine, stepper specs; `e2e/design-r3-book-cover.spec.ts`, `e2e/parent-spreads-edit.spec.ts`).
- [x] 4. e2e `page-count-agree.spec.ts`: top bar, Book settings and list agree on 4 for the fixture; stepper presets equal the last page label; count box > 0 and topmost at its centre.

## Manual test scenarios

1. Open the fixture book: top bar reads "· 4 pages", Book settings Pages reads 4, the Spreads list ends at page 4.
2. Type 20 into Pages + Enter: the list ends at page 20, top bar reads 20 pages.
