## Implementation

- [ ] 1. `src/site/siteModel.ts` (+ `.test.ts`, `.pbt.test.ts`): slides, labels, page count, hash, columns, book object height, stage width, `sizes`.
- [ ] 2. Views: `SiteApp`, `SiteCatalog`, `SiteBookPage`, `SiteStage`, `site.css` (`--site-*`), with key / swipe component tests.
- [ ] 3. `ShareButton` (+ test) and the `share` / `arrowLeft` glyphs (`Icon.test.tsx` list).
- [ ] 4. `renderSitePage.tsx` (+ snapshot test): document shell, meta / og / canonical, `#site-data`, sanitized book.
- [ ] 5. Export: `SitePageRenderer` string contract, `SitePageInput` built in `buildSiteTree`, placeholder renderer removed, tests updated.
- [ ] 6. Entry: `site.html`, `vite.config.ts` input, `main.tsx` (hydrate, sample site, perf hooks), `budget.json` + gates entry, `docs/design.md` tokens.
- [ ] 7. `e2e/site-viewer.spec.ts`: functional checks + frame-budget scenario.

## Manual test scenarios

1. Open `/site.html`: catalog with two books; open a book; step through every spread with → and the Next button; Share shows "Link copied" for 2 s; `#p6` deep link; 390 × 844 has no horizontal scroll.
