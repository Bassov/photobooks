## Proposal

Roadmap: [`docs/roadmap/P4/design-r22-crop-srcset.md`](../../../docs/roadmap/P4/design-r22-crop-srcset.md) (scope / Done when / Browser).

### Scope out

- Static export HTML (`src/site/renderSitePage.tsx`, `src/site/export/*`): lane of `design-r22-export-fonts`; it renders `SiteStage`, so it inherits the fix without edits.
- Derivative widths and `frameSizes` breakpoints: unchanged.

### Delta / Risk

- `imageFor(assetId, widthMm)` now means the drawn width; `SiteStage` keeps its share math. An unlisted `?book=crop` sample on `site.html` gives the e2e a cropped photo; the catalog still lists Alps and Sea only.
