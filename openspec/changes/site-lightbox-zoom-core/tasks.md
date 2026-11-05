## Implementation

- [x] 1. `src/render/pagerZoom.ts`: constants, `Zoom` / `Rect` / `Insets` types, `fitInsets`, `fitArea`, `fitBox` (unit `fitBox (spec §2 table)`).
- [x] 2. `clampPan`, `zoomAt`, `wheelFactor`, `settle` (unit `clampPan` / `zoomAt` / `wheelFactor` / `settle`).
- [x] 3. Unit tests `src/render/pagerZoom.test.ts` (spec fit table, clamp branches, wheel modes, settle): 25 tests green.
- [x] 4. Property tests `src/render/pagerZoom.pbt.test.ts` (range, z = 1 ⇒ no pan, idempotent clamp, anchor, round trip): 5 properties green; stryker-diff 98.44 (threshold 85).

## Manual test scenarios

N/A: pure model, no UI (code review only per the brief).
