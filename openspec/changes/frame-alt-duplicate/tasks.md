## Implementation

- [x] 1. `frameDuplicate.ts`: targets, clones, paint / clear, Alt cursor attribute; `frameClipboard.ts` `duplicateFramesBy` (sets `lastDuplicate`). Evidence: `frameGesture.duplicate.test.ts` (paint, D8 Ctrl+D, cursor).
- [x] 2. `frameGesture.ts`: `duplicate` session routing, `altLatch` in `snapBypassed` / `gridSnapActive`, `onDragStart` guard, Esc / cancel. Evidence: `frameGesture.duplicate.test.ts` (latch, Esc, dragstart); existing Alt-at-press unit presses moved after the press, `e2e/interface-size-pointer.spec.ts` likewise.
- [x] 3. `SpreadView.css`: `cursor: copy`, originals' chrome hidden while duplicating. Evidence: `e2e/frame-copy-paste.spec.ts` (computed cursor, ring pixels).
- [x] 4. Unit `frameGesture.duplicate.test.ts`; e2e `frame-copy-paste.spec.ts` Alt-drag cases.

## Manual test scenarios

1. Select tool, hold Alt over a frame: the cursor is `copy`. Press, drag 40 px: a translucent ringed clone follows, the original stays. Release: a new selected frame at the drop; Undo removes it.
2. Alt-press and release without moving: the frame is selected, nothing added.
3. Alt-press, drag, Esc, release: nothing added, no undo step.

`pnpm agent manual-qa` (2026-11-21): problem (harness) — 1–3 never reached the editor: the `start-session` click was intercepted by the welcome-screen header (30 s timeout). Not a product result. The same scenarios are covered by `e2e/frame-copy-paste.spec.ts` (Alt-drag clone paint + ring pixels + count + Undo label + Ctrl+D; Alt click selects; Esc adds nothing; computed `cursor: copy`), all green locally.
