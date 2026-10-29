## Implementation

- [x] 1. Page anchors + `snapEdges` in `snapIndex.ts` (`snapIndex.test.ts`, `snapIndex.bench.ts`)
- [x] 2. Snap toggle gates move / draw; `frame` label (`frameGesture.test.ts`)
- [x] 3. Handle resize snaps with lines, cleared on end (`frameHandleGesture.test.ts`)
- [x] 4. TopBar Magnet `SnapToggle` + icon (`SnapToggle.test.tsx`, `Icon.test.tsx`)
- [x] 5. Roadmap SoT + e2e Shift+S (`free-frames.spec.ts`)

## Manual test scenarios

1. Two frames, drag edge to align → `snap · frame`; Alt-drag → none; Shift+S off → none.
