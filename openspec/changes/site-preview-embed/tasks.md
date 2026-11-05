## Implementation

- [x] 1. `stageWidth` `allBooks` option + unit / PBT (`siteModel.test.ts`, `siteModel.pbt.test.ts`).
- [x] 2. `useViewport` `{ height: 'element' }` + unit (`useViewport.test.tsx`).
- [x] 3. `SiteBookPage` `embedded`, `allBooks`, `share`; `renderSlide` through `SiteStage` and `SiteLightbox` + unit (`SiteBookPage.embedded.test.tsx`).
- [x] 4. Split `site.css` / `siteViewer.css` (built `site-*.css` byte-identical to `origin/main`'s).

## Manual test scenarios

N/A: no visible change on the published site; covered by the `renderSitePage` snapshot and the site-viewer / site-lightbox e2e (18/18 local).
