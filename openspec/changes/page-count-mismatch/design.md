## Decisions

1. `pagesOf(spreads)` in `src/core/pages.ts` is the one printed page count: `spreads ≤ 1 ? max(0, spreads) : 2 × (spreads − 1)`, the sum of `getSpreadPageCount` (single page 1 and last page). `sitePageCount` (same formula) is deleted; site callers, including `slideForHash`, import `pagesOf`.
2. New `spreadsForPages(pages)` = `pages / 2 + 1`; `setPageCount` targets `spreadsForPages(clampPageCount(pages))`, so 20 → 11 spreads listing pages 1 … 20.
3. Changed callers: top bar `bookSizeLine` and Book settings get the fix through `pagesOf`; `BookTile` replaces `spreads * 2` with `pagesOf`; `bookSpineWidthMm` follows. A one-spread book now has 1 page, so `pagesText` writes `1 page` / `N pages` for the top bar, library caption, site meta and catalog card. No tokens or primitives change.

## Touch-set & Test Plan

| File                               |
| ---------------------------------- |
| `src/core/pages.ts`                |
| `src/core/ops/spreads.ts`          |
| `src/core/index.ts`                |
| `src/editor/BookTile.tsx`          |
| `src/editor/editorChromePanels.ts` |
| `src/editor/libraryEditedLabel.ts` |
| `src/site/SiteCatalog.tsx`         |
| `src/site/siteModel.ts`            |
| `src/site/SiteBookPage.tsx`        |
| `src/site/renderSitePage.tsx`      |
| `src/site/sampleSite.ts`           |
| `src/site/export/buildSiteTree.ts` |
| `e2e/page-count-agree.spec.ts`     |

- Reuse: `getSpreadPageCount`, `pageLabel`, `clampPageCount`.
- Unit: `pagesOf` for 0, 1, 2 → 2, 3 spreads → 4 pages, 11 → 20; `spreadsForPages`; existing expectations updated.
- PBT: `pagesOf` = sum of `getSpreadPageCount`; `setPageCount` lands on `clampPageCount(pages)`.
- e2e: fixture top bar, Book settings and last list label read 4 (box > 0); stepper presets equal the last page label.
