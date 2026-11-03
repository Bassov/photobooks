## Implementation

- [x] 1. Core `moveFrames` op (`transform.ts`, `applyBookOp.ts`) + PBT in `transform.test.ts` (`describe('moveFrames')`: locked never move, equals folded `moveFrame`)
- [x] 2. Undo label "Move N frames" (`bookHistory.ts` + `bookHistory.test.ts` "counts the frames of a group move")
- [x] 3. Group move session in `frameGesture.ts`: start on a selected body (2+), union snap / clamp / Shift axis, translate preview + live group box, one `moveFrames` on release, Esc / cancel restore, all-locked status; `frameGesture.test.ts` `describe('frameGesture · group move')`
- [x] 4. Arrows / Shift+arrows nudge the set in `frameHandleGesture.ts` (preventDefault, all-locked status); `frameHandleGesture.test.ts` `describe('a set of frames')`
- [x] 5. e2e `multi-select.spec.ts`: group move one undo + locked stays, Esc mid-move, ArrowRight without pasteboard scroll, group box per drag frame, 3-frame group move frame-budget gate

## Manual test scenarios

1. Select three frames on a spread (lock one first), drag one: the two unlocked move together, the locked stays, one Undo puts them back.
2. Mid-drag press Esc: all frames back, three still selected.
3. ArrowRight / Shift+ArrowRight with the set: frames nudge 1 / 10 mm, the pasteboard does not scroll.
