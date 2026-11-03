## Implementation

- [ ] 1. `snapIndex.ts`: `paintedBox`, `buildFrameHitIndex`, `hitFrames` + unit tests (overlap, touch, rotated, miss).
- [ ] 2. `frameSelection.ts`: `setFrameSelection(next)` for a whole set.
- [ ] 3. `marquee.ts` + `frameGesture.ts`: marquee session (target spread, 3 px slop, live hits, release / Shift-union, Esc / cancel restore, `selectstart` off); unit tests in `Pasteboard.click.test.tsx` and `frameGesture.test.ts`.
- [ ] 4. `SpreadView.css` + `docs/design.md`: `.marquee-box` and `data-marquee-hit` outline.
- [ ] 5. e2e `multi-select.spec.ts`: full-bleed + 4-grid pasteboard marquee, Shift-union, Esc, Hand pan, frame-budget gate.
- [ ] 6. Kit: `canvas.tsx` Shift-union, live hit outlines, rotated AABB, Esc; `viewport.tsx` pasteboard marquee (spread under the press or nearest); `pages.tsx` notes.

## Manual test scenarios

1. Painter fixture, spread 2–3: drag from the gray left of the spread across the top row → 2 frames pressed, live outlines during the drag, box in screen px.
2. Shift+drag a second marquee over the bottom row → 4 pressed; Esc mid-marquee → previous set back.
3. Hand tool drag on the pasteboard → pans, no marquee; a short click on the gray → spread active, selection cleared.
