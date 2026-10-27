## Implementation

- [x] 1. `pagerIndex.ts` clamp/step helpers + PBT.
- [x] 2. `SpreadPager` with keys, click halves, swipe, neighbour preload, transform/opacity transition + tests.
- [x] 3. `PresentationMode` overlay using `ConnectedSpreadView`; design.md tokens.
- [x] 4. Wire Present button and `EditorShell` (unmount Pasteboard while presenting).
- [x] 5. e2e: disabled/empty, happy flip + Esc, last-spread no-op, 40-spread `frame-budget` (+ `perf` script).
- [x] 6. spread-view spec delta.

## Manual test scenarios

1. Present a multi-spread book; flip with keys and click; Esc restores the editor with the same selection.
2. Swipe with touch/trackpad emulation.
3. Last spread: next does nothing.
4. Flip quickly through a long book like a finished album.
