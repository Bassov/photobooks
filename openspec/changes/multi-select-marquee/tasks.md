## Implementation

- [x] 1. `snapIndex.ts`: `paintedBox`, `buildFrameHitIndex`, `hitFrames` + unit tests (overlap, touch, rotated, miss). — `snapIndex.test.ts` "frame hit index" (+ PBT vs brute force).
- [x] 2. `frameSelection.ts`: `setFrameSelection(next)` for a whole set. — `frameSelection.test.ts` "sets a whole set at once".
- [x] 3. `marquee.ts` + `frameGesture.ts`: marquee session (target spread, 3 px slop, live hits, release / Shift-union, Esc / cancel restore, `selectstart` off); unit tests in `Pasteboard.click.test.tsx` and `frameGesture.test.ts`. — "Pasteboard marquee from the gray", "frameGesture · marquee on the paper"; stryker:diff 97.07 %.
- [x] 4. `SpreadView.css` + `docs/design.md`: `.marquee-box` and `data-marquee-hit` outline. — e2e computed look check.
- [x] 5. e2e `multi-select.spec.ts`: full-bleed + 4-grid pasteboard marquee, Shift-union, Esc, Hand pan, frame-budget gate. — "multi-select part 3: marquee" + "a marquee over a full spread logs no LoAF".
- [x] 6. Kit: `canvas.tsx` Shift-union, live hit outlines, rotated AABB, Esc; `viewport.tsx` pasteboard marquee (spread under the press or nearest); `pages.tsx` notes. — `uikit:qa:quick` 278/0; Two frames scenario: gray marquee 1 hit, Shift union 3.

## Manual test scenarios

1. Painter fixture, spread 2–3: drag from the gray left of the spread across the top row → 2 frames pressed, live outlines during the drag, box in screen px.
2. Shift+drag a second marquee over the bottom row → 4 pressed; Esc mid-marquee → previous set back.
3. Hand tool drag on the pasteboard → pans, no marquee; a short click on the gray → spread active, selection cleared.

manual-qa: 1–3 problem (harness) — blocked at welcome (`start-session` click intercepted by the header); covered by e2e `multi-select.spec.ts` "multi-select part 3: marquee" and `Pasteboard.click.test.tsx`.
