## Implementation

- [x] 1. `frameDuplicate.ts`: targets, clones, paint / clear, Alt cursor attribute; `frameClipboard.ts` `duplicateFramesBy` (sets `lastDuplicate`). Evidence: `frameGesture.duplicate.test.ts` (paint, D8 Ctrl+D, cursor).
- [x] 2. `frameGesture.ts`: `duplicate` session routing, `altLatch` in `snapBypassed` / `gridSnapActive`, `onDragStart` guard, Esc / cancel. Evidence: `frameGesture.duplicate.test.ts` (latch, Esc, dragstart); existing Alt-at-press unit presses moved after the press, `e2e/interface-size-pointer.spec.ts` likewise.
- [x] 3. `SpreadView.css`: `cursor: copy`, originals' chrome hidden while duplicating. Evidence: `e2e/frame-copy-paste.spec.ts` (computed cursor, ring pixels).
- [x] 4. Unit `frameGesture.duplicate.test.ts`; e2e `frame-copy-paste.spec.ts` Alt-drag cases.

## Manual test scenarios

1. Select tool, hold Alt over a frame: the cursor is `copy`. Press, drag 40 px: a translucent ringed clone follows, the original stays. Release: a new selected frame at the drop; Undo removes it.
2. Alt-press and release without moving: the frame is selected, nothing added.
3. Alt-press, drag, Esc, release: nothing added, no undo step.
