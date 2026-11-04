## Implementation

- [x] 1. `spreadContext` snap guides: book guides + `viewGuides`, none while guides are hidden (`src/editor/frameGesture.ts`).
- [x] 2. Unit: parent-guide snap (horizontal + mapped vertical, draw and move) and hidden-guides-no-snap (book, own, parent) in `src/editor/frameGesture.test.ts`.
- [x] 3. e2e: snap half of the browser check in `e2e/parent-spreads-guides.spec.ts` (snaps near a master guide; no snap after Ctrl+;) — red with the snap source disabled, green with the fix.
- [x] 4. Spec delta: pasteboard snap requirement names visible guides incl. parent ones.

## Manual test scenarios

1. Pages, a Master A spread with a master guide shown dashed: press F and draw a frame whose edge ends a few px from the dashed line → snap line + `snap · guide` pill, the edge lands on the line.
2. Ctrl+; hides guides; the same draw → no snap line, the edge stays at the pointer.
