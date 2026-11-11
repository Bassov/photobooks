## Implementation

- [x] 1. `drawnWidthMm(item)` in `src/render/frameBox.ts` with unit tests (`src/render/frameBox.test.ts`).
- [x] 2. `SpreadView` passes the drawn width to `imageFor`; unit test for a landscape photo in a portrait frame (`src/render/SpreadView.imageFor.test.tsx`).
- [x] 3. Unlisted `crop` sample book in `src/site/sampleSite.ts`.
- [x] 4. e2e `e2e/site-crop-srcset.spec.ts`: page 1 picks a candidate ≥ drawn px at DPR 1 (fails with 480w for a 600 px image when the frame width is passed back in).

## Manual test scenarios

1. `site.html?book=crop` at 1440 × 900: the page 1 photo is sharp; its `currentSrc` width is at least its painted width.
