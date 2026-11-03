## Implementation

- [x] 1. Red tests: core swap / unplace / gallery removal / fill with locked frames; `resolveFrameActivation` and `activateFrame` with a locked source and target — `ops.test.ts` "placement ops and locked frames", `fill.test.ts` "skips locked frames…", `dropTargets.test.ts` "refuses the swap…", `galleryDrop.activate.test.ts` "a locked %s refuses the click swap" (10 red before the fix)
- [x] 2. Core: lock guard in `swapFrames`, `placeAsset`, `replaceAsset`, `fillSpread`; `withoutPlacement` keeps frame fields in swap, unplace and gallery removal — `place.ts`, `fill.ts`, `gallery.ts`
- [x] 3. Editor: `locked` activation in `dropTargets.ts`; `activateFrame` shows the frame-locked status and keeps the selection — `galleryDrop.ts`; check:fast, e2e-changed, stryker-diff green

## Manual test scenarios

1. Lock a filled frame, select it, click another filled frame → photos stay, status shows the frame-locked message, frame still locked, Undo has no new step.
2. Select an unlocked filled frame, click a locked filled frame → same result.
3. Two unlocked filled frames → click swap still swaps (status "swapped").

OK 1–3: walked in Chromium by `e2e/arrange-lock.spec.ts` "a locked frame refuses the click swap as source and target" (pass, 1.0 m). No visual change, so no manual-qa screenshot run (brief).
