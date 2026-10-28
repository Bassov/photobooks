## Implementation

- [x] 1. `frameHandleMath.ts` resize / rotate math + unit tests — `frameHandleMath.test.ts`
- [x] 2. `frameHandleGesture.ts` resize, rotate, arrow nudge, click-empty deselect via BookOps — `frameHandleGesture.test.ts`
- [x] 3. Handle / rotate / size-tag overlay in `SpreadView`, locked flag in resolved geometry
- [x] 4. Selected-frame body drag move; locked frame reports status — `frameGesture.test.ts`

## Manual test scenarios

1. Select a photo → 8 handles + rotate handle; drag body, corner, rotate handle; Esc clears.
2. Locked frame → outline only, drag shows "Frame is locked".
