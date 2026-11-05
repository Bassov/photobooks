## Implementation

- [x] 1. `SpreadView` paints folios in the parent layer (not in thumbs) + `.spread-view-folio` CSS; `SpreadView.parent.test.tsx` cases. Store repaint on `pageNumbers` / `pageNumbering` edits (`bookStore.test.ts` "page-number edits repaint…").
- [x] 2. `MastersCanvas` `#` chips at the folio boxes (`MastersCanvas.test.tsx` "marks each folio box…").
- [x] 3. `MasterSection` "Page numbers" (Show, position seg, hint + Book settings link); Masters-mode Inspector shows Book settings while selected (`MasterSection.test.tsx`, `Inspector.test.tsx`, `LeftPanel.test.tsx`).
- [x] 4. `BookSettingsSection` "Page numbers" (Start at, Format, Skip first page, note); pinned unit / e2e section lists and y values (`BookSettingsPageNumbers.test.tsx`, `design-r10-inspectors.spec.ts`).
- [x] 5. `e2e/page-numbers.spec.ts` (positions, reorder, skip, roman, zoom, chips) and `e2e/page-numbers-perf.spec.ts` (40 spreads: Show on 0 LoAF / INP 32 ms, reorder 0 LoAF / INP 48 ms).

## Manual test scenarios

1. `?fixture=painter&parent=a`: Masters → Master A → Page numbers Show on → every page shows its number at the bottom outer corner; Centre / Inner move them.
2. Hint "Book settings" → Book settings opens; Start at 5, roman, Skip first page → the spreads update; the note reads accordingly.
3. Reorder a spread in the spreads list → numbers follow the page positions; the spread list thumbs show no numbers.

`pnpm agent manual-qa --change page-numbers` (2026-11-05): scenarios 1–3 problem (harness): the `start-session` click times out at the welcome screen (the welcome header intercepts pointer events), before the editor opens; known harness issue, not a product defect. Covered by e2e instead: 1 → `e2e/page-numbers.spec.ts` "Show on: every page is numbered at the Outer / Centre / Inner box"; 2 and 3 → "folios renumber after a reorder, skip page 1 and print roman" and the thumbs assertion in the Show on test; 40-spread scale → `e2e/page-numbers-perf.spec.ts`.
