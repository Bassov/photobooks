## Implementation

- [x] 1. `src/site/siteModel.ts` (+ `.test.ts`, `.pbt.test.ts`): slides, labels, page count, hash, columns, book object height, stage width, `sizes`. Evidence: `siteModel.test.ts`, `siteModel.pbt.test.ts` (1000 runs).
- [x] 2. Views: `SiteApp`, `SiteCatalog`, `SiteBookPage`, `SiteStage`, `site.css` (`--site-*`), with key / swipe component tests. Evidence: `SiteBookPage.test.tsx`, `useViewport.test.tsx`.
- [x] 3. `ShareButton` (+ test) and the `share` / `arrowLeft` glyphs (`Icon.test.tsx` list). Evidence: `ShareButton.test.tsx`, `src/ui/Icon.test.tsx`.
- [x] 4. `renderSitePage.tsx` (+ snapshot test): document shell, meta / og / canonical, `#site-data`, sanitized book. Evidence: `renderSitePage.test.tsx` (+ snapshot, PBT, hydration).
- [x] 5. Export: `SitePageRenderer` string contract, `SitePageInput` built in `buildSiteTree`, placeholder renderer removed, tests updated. Evidence: `buildSiteTree.pages.test.ts`, `buildSiteTree.test.ts`.
- [x] 6. Entry: `site.html`, `vite.config.ts` input, `main.tsx` (hydrate, sample site, perf hooks), `budget.json` + gates entry, `docs/design.md` tokens. Evidence: `startSite.test.tsx`, commit 3b1d48c0.
- [x] 7. `e2e/site-viewer.spec.ts`: functional checks + frame-budget scenario. Evidence: 7/7 locally, `test:e2e:changed:quiet` OK.

## Manual test scenarios

1. Open `/site.html`: catalog with two books; open a book; step through every spread with → and the Next button; Share shows "Link copied" for 2 s; `#p6` deep link; 390 × 844 has no horizontal scroll.

- problem (harness): `pnpm agent manual-qa` drives the editor welcome flow and timed out on `start-session` (welcome header intercepts the click), so it never opened `/site.html`.
- OK (e2e): `e2e/site-viewer.spec.ts` 7/7 locally covers every scenario above plus the ×4 CPU frame-budget run (0 LoAF).
