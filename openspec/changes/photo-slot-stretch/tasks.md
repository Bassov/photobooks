## Implementation

- [x] 1. Failing DOM test `src/editor/photoSlotAspect.test.tsx`: placeholder aspect, portrait + EXIF-6 photos in landscape and portrait frames, 320 → 1280 tier swap, replace in a filled frame → image box aspect = natural aspect ±1 %. (6/6 failed before the fix: stretch 1.5 / 1.33; green after.)
- [x] 2. `restoreAspectFromImage` in `src/editor/previewAspect.ts` (placeholder-only, 1 % tolerance) + unit tests (`previewAspect.test.ts`).
- [x] 3. `src/editor/tierDisplay.ts` reports the decoded tier's natural size before publishing the swap (`photoSlotAspect.test.tsx`).
- [x] 4. `.spread-frame-image { object-fit: cover }` in `src/render/SpreadView.css` (`place-fit-aspect.spec.ts` asserts computed `object-fit`).
- [x] 5. e2e `e2e/place-fit-aspect.spec.ts`: settled tier and replace-in-filled-frame aspect checks on canvas + Pages thumbs (changed e2e 3/3 green).

## Manual test scenarios

1. Import a folder with a portrait and an EXIF-6 photo, place both, reload the book → the photos are never stretched, before and after they sharpen.
2. Replace a placed photo by dropping another one on the filled frame → the new photo keeps its aspect.

manual-qa: harness problem — `start-session` click intercepted by the welcome header (both scenarios not reached). Covered by `e2e/place-fit-aspect.spec.ts` (tier swap + replace on canvas and Pages thumbs) and `src/editor/photoSlotAspect.test.tsx` (placeholder aspect = the reload state).
