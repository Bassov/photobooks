## Implementation

- [ ] 1. `bookImage` glyph, `fillBookStatus` + pill regex, chip CSS in `editorChromeTokens.ts`.
- [ ] 2. `FillBookButton.tsx`: disabled reasons, popover rows / notes / nothing-fits, focus, Enter / Esc / Cancel.
- [ ] 3. Confirm flow: `fillBook` op, first changed spread active, no frame, `revealFrames`, status 4000 ms.
- [ ] 4. `FilmstripDock.tsx` renders the chip first; unit tests (`FillBookButton.test.tsx`, `FilmstripDock.test.tsx`,
      `editorStatus.test.ts`).
- [ ] 5. `e2e/fill-book.spec.ts` (Spec prod cases + kit box sizes) and `e2e/kit10-filmstrip.spec.ts` pin.

## Manual test scenarios

1. New book + 12 photos at 1440×900: Fill book → popover rows "4 photos" / "8 photos · 4 spreads" / "4 → 12"; Enter → 7 spreads,
   status "Placed 12 photos · added 4 spreads", chip disabled; Ctrl+Z → 3 spreads, "0 used".
2. Open the popover, Esc → no change, focus on the chip; Masters tab → chip disabled.
