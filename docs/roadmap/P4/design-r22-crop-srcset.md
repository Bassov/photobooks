# design-r22-crop-srcset

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r22-crop-srcset

## Scope

- [ ] Cropped photos on the site are no longer upscaled (Designer static-export r22, M105): `SpreadView` passes `imageFor` the drawn image width in mm (frame width over the crop window width, the frame height for odd quarter turns), not the frame width, so `SiteStage` builds `sizes` from the painted width.
- [ ] Bug rule: every `imageFor` caller / implementation (today `src/render/SpreadView.tsx` and `src/site/SiteStage.tsx`) uses the drawn width; the PR body lists each as fixed or left out with a reason.
- **Browser check:** `site.html?book=crop` at 1440 × 900, DPR 1: the page 1 photo (landscape in a portrait frame) loads a srcset candidate at least as wide as it is drawn.

## Done when

- Unit test next to `SpreadView.imageFor.test.tsx`: landscape photo in a portrait frame → `imageFor` gets the drawn width, not the frame width.
- e2e on the site stage: page 1 of the crop sample picks a candidate ≥ the drawn px (no upscale > 1.0× at DPR 1), checked as `currentSrc` width vs the image's painted width.
- No edits to `src/site/renderSitePage.tsx`, `src/site/export/*` or `uikit/`.
