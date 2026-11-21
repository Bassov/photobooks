## Implementation

- [x] 1. `bookImage` glyph, `fillBookStatus` + pill regex, chip CSS in `editorChromeTokens.ts` (`editorStatus.test.ts`,
      `editorChromeTokens.test.ts`, `Icon.test.tsx`).
- [x] 2. `FillBookButton.tsx`: disabled reasons, popover rows / notes / nothing-fits, focus, Enter / Esc / Cancel
      (`FillBookButton.test.tsx`; focus in `e2e/fill-book.spec.ts`).
- [x] 3. Confirm flow: `fillBook` op ("Fill book" label in `bookHistory.ts`), first changed spread active, no frame,
      `revealFrames`, status 4000 ms (`FillBookButton.test.tsx` confirm cases).
- [x] 4. `FilmstripDock.tsx` renders the chip first; unit tests (`FilmstripDock.test.tsx` chip order with / without Add folder).
- [x] 5. `e2e/fill-book.spec.ts` (Spec prod cases + kit box sizes) and `e2e/kit10-filmstrip.spec.ts` pin — 2 + 4 passed locally.

## Manual test scenarios

1. New book + 12 photos at 1440×900: Fill book → popover rows "4 photos" / "8 photos · 4 spreads" / "4 → 12"; Enter → 7 spreads,
   status "Placed 12 photos · added 4 spreads", chip disabled; Ctrl+Z → 3 spreads, "0 used".
2. Open the popover, Esc → no change, focus on the chip; Masters tab → chip disabled.

manual-qa (`pnpm agent manual-qa --change fill-book`): problem (harness) — 1 and 2 blocked at the welcome screen
(`start-session` click intercepted by the welcome header), no fill-book step reached. Evidence instead: `e2e/fill-book.spec.ts`
drives both scenarios at 1440×900 (2 passed locally).
