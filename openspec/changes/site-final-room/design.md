## Decisions

1. **Views** match the GL reader: 0 cover, `v` = spread `v − 1`, `n + 1` back cover; for 0…n a view equals the old slide, so `hashForSlide` / `slideForHash` stay.
2. **Data**: the book page input gains `entry: SiteCatalogBook`, so `book.json` = page input; GL cover panels reuse `book3dGl.glInput`.
3. **Lazy GL** via a new `book/roomGl.ts` dynamic import (like `Book3D`); faces reuse P3's `createFaceSource` (one page per task with a yield, focused view ± 2 first; no new main-thread batch). No WebGL2 / `?gl=0` / embedded → CSS reader.
4. **History** lives in `SiteApp`: open = `pushState`, close = `history.back()`, `popstate` closes; a direct book URL has a plain "All books" link.
5. `SiteBookPage` / `SiteStage` / `site.css` / `siteViewer.css` are deleted; `SlideContent` moves to `SiteSlide.tsx`.
6. **Security**: `book.json` is fetched only from the clicked same-origin book href; image and page URLs go through `imageSrc` / `pageHref`.
7. Tokens mirror the kit `system.css` (`--ss-*` in `styles/tokens.css`). One change because the deleted page has no partial replacement.

## Touch-set & Test Plan

| File                                      | Why                 |
| ----------------------------------------- | ------------------- |
| `src/site/SiteRoom.tsx`                   | room                |
| `src/site/SiteRoom.test.tsx`              | foot, Share, slides |
| `src/site/SiteApp.tsx`                    | history             |
| `src/site/SiteApp.test.tsx`               | history             |
| `src/site/startSite.tsx`                  | loader              |
| `src/site/startSite.test.tsx`             | loader              |
| `src/site/ShareButton.tsx`                | D36                 |
| `src/site/ShareButton.test.tsx`           | Copied              |
| `src/site/SiteLightbox.tsx`               | spreads only        |
| `src/site/SiteSlide.tsx`                  | slide paint         |
| `src/site/SiteBookPage.tsx`               | deleted             |
| `src/site/SiteStage.tsx`                  | deleted             |
| `src/site/SiteBookPage.test.tsx`          | deleted             |
| `src/site/SiteBookPage.embedded.test.tsx` | deleted             |
| `src/site/site.css`                       | deleted             |
| `src/site/siteViewer.css`                 | deleted             |
| `src/site/siteSystem.css`                 | utilities           |
| `src/site/main.tsx`                       | CSS entry           |
| `src/site/siteInput.ts`                   | `entry`             |
| `src/site/siteModel.ts`                   | labels, slides      |
| `src/site/siteModel.test.ts`              | labels              |
| `src/site/siteModel.book.test.ts`         | slides              |
| `src/site/siteModel.pbt.test.ts`          | hash                |
| `src/site/sampleSite.ts`                  | `entry`             |
| `src/site/renderSitePage.tsx`             | prerender           |
| `src/site/renderSitePage.test.tsx`        | prerender           |
| `src/site/export/buildSiteTree.ts`        | `entry`             |
| `src/site/export/buildSiteTree.test.ts`   | `entry`             |
| `src/site/book/reader.tsx`                | reader              |
| `src/site/book/slides.tsx`                | carousel            |
| `src/site/book/turn.tsx`                  | page turn           |
| `src/site/book/room.css`                  | room CSS            |
| `src/site/book/roomGl.ts`                 | lazy GL             |
| `src/site/book/roomGl.test.ts`            | lazy GL             |
| `src/editor/SitePreview.tsx`              | swap                |
| `src/editor/SitePreview.test.tsx`         | selectors           |
| `styles/tokens.css`                       | tokens              |
| `e2e/site-final.spec.ts`                  | checkpoints         |
| `e2e/site-reader-gl.spec.ts`              | kit T1/T2           |
| `e2e/site-viewer.spec.ts`                 | selectors           |
| `e2e/site-lightbox.spec.ts`               | selectors           |
| `e2e/site-preview-mode.spec.ts`           | selectors           |
| `e2e/static-export.spec.ts`               | selectors           |
| `e2e/static-export-viewer.spec.ts`        | selectors           |
| `e2e/site-crop-srcset.spec.ts`            | selectors           |
