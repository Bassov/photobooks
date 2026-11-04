## Implementation

- [x] 1. `spreadContext` snap guides: book guides + `viewGuides`, none while guides are hidden (`src/editor/frameGesture.ts`).
- [x] 2. Unit: parent-guide snap (horizontal + mapped vertical, draw and move) and hidden-guides-no-snap (book, own, parent) in `src/editor/frameGesture.test.ts`.
- [x] 3. e2e: snap half of the browser check in `e2e/parent-spreads-guides.spec.ts` (snaps near a master guide; no snap after Ctrl+;) — red with the snap source disabled, green with the fix.
- [x] 4. Spec delta: pasteboard snap requirement names visible guides incl. parent ones.

## Manual test scenarios

1. Pages, a Master A spread with a master guide shown dashed: press F and draw a frame whose edge ends a few px from the dashed line → snap line + `snap · guide` pill, the edge lands on the line.
2. Ctrl+; hides guides; the same draw → no snap line, the edge stays at the pointer.

`pnpm agent manual-qa` (2026-11-04): problem — harness: `start-session` click intercepted by the welcome header, editor never opened (0/2 observed, not a product result). Both scenarios are the e2e `Browser check: a frame drawn near a master guide snaps to it; hidden guides do not snap` (`e2e/parent-spreads-guides.spec.ts`): passed locally, 3/3 with `--repeat-each=3`; red with the snap source disabled.
