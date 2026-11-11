## Decisions

1. D38: one pure `siteBookFacts(book, publishedAtMs)` in `siteModel.ts`, used by export and sample; `SiteCatalogBook` spreads it in.
2. `book.json` = key-sorted book-page input + `entry: SiteCatalogBook`, next to `index.html` so page-relative URLs hold.
3. Fonts (M104): the manifest plugin reads `<publicDir>/fonts/fonts.css`, lists it first in `css`, its files in `files`, Latin normal faces in `preload`. `siteViewerBundle.ts` only passes `preload` through. Page heads add `rel=preload as=font crossorigin`.
4. D40 `siteSlides(book)` → `{spread, side: left|right|both}[]` over resolved frames: no frame on a page → skipped; a frame spanning the gutter → one `both` slide. Endpapers are not spreads; the cover is the room's.
5. Sample: `intro` + square `lake` book with a panorama and a blank page.
6. Security: `book.json` carries asset ids only (no GPS / paths); fonts are same-origin static files, no CSP change.

## Touch-set & Test Plan

| File                                    | Why          |
| --------------------------------------- | ------------ |
| `src/site/siteInput.ts`                 | types        |
| `src/site/siteModel.ts`                 | D38, D40     |
| `src/site/sampleSite.ts`                | sample       |
| `src/site/export/buildSiteTree.ts`      | book.json    |
| `src/site/export/types.ts`              | preload      |
| `src/site/renderSitePage.tsx`           | preloads     |
| `scripts/vite-site-viewer-manifest.mjs` | fonts        |
| `src/editor/export/siteViewerBundle.ts` | pass-through |
| `e2e/static-export-viewer.spec.ts`      | fonts        |
| `e2e/site-viewer.spec.ts`               | 3 books      |
| `src/site/siteModel.book.test.ts`       | D38, D40     |
| `src/editor/EditorShell.test.tsx`       | load timeout |
| `src/project/libraryDocument.test.ts`   | load timeout |

- Unit/PBT: D38 (0.23 both sides, UTC year), D40 (blank, gutter, parents), book.json per book, byte-identical re-export, manifest fonts, head preloads.
- e2e: served export: fonts exist and load, no 4xx.
