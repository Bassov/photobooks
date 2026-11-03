## Implementation

- [ ] 1. Red tests: core swap / unplace / gallery removal / fill with locked frames; `resolveFrameActivation` and `activateFrame` with a locked source and target
- [ ] 2. Core: lock guard in `swapFrames`, `placeAsset`, `replaceAsset`, `fillSpread`; `withoutPlacement` keeps frame fields in swap, unplace and gallery removal
- [ ] 3. Editor: `locked` activation in `dropTargets.ts`; `activateFrame` shows the frame-locked status and keeps the selection

## Manual test scenarios

1. Lock a filled frame, select it, click another filled frame → photos stay, status shows the frame-locked message, frame still locked, Undo has no new step.
2. Select an unlocked filled frame, click a locked filled frame → same result.
3. Two unlocked filled frames → click swap still swaps (status "swapped").
