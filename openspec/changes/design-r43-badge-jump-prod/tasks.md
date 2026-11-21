## Implementation

- [x] 1. e2e scroll-trace tests (200 % fresh / re-click / cycle, 1060 wide) red on main (`e2e/placed-badge.spec.ts`)
- [x] 2. Frame-targeted reveal in `pasteboardReveal.ts` (`insetPortSettled`, frame branch of `revealLaidOutSpread`, post-paint check) + unit tests
- [x] 3. Thread `frameId` through `requestSpreadReveal` → `Pasteboard` → `usePasteboardReveal` (default `null`, other callers unchanged) + hook test
- [x] 4. `placedJump.goTo` requests the frame reveal; drop the rAF settle nudge + unit tests

## Manual test scenarios

1. 200 %, Page 1 active: click the placed badge of a photo on Pages 2–3 → the pasteboard moves once per axis to the centred frame; click again → nothing moves.
2. 1060 × 900, default zoom: badge jump → the frame lands ≥ 24 px right of the spread list without a back-jump.
