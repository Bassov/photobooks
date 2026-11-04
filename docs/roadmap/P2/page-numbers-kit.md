# page-numbers-kit

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item page-numbers-kit

## Scope

Kit part of page numbers (Designer design `page-numbers`, 2026-11-04). The master decides whether and where (Show + Outer/Centre/Inner); the book decides how it counts (Start at, Format, Skip first page). Kit only (`uikit/`); prod follows in `page-numbers-core` / `page-numbers`.

- [ ] `uikit/src/sandbox/model.ts`: `Doc.pageFormat`, `MASTER_POS` + `pageNumberPosOf`, folio geometry / text helpers; Master A's two "Folio" frames become one "Chapter" text frame.
- [ ] `uikit/src/sandbox/canvas.tsx`: one folio branch for canvas and Preview: box 20 × 4.34 mm, `y = min(H − bottom/2 − 2.17, H − safe − 4.34)`, Outer / Centre / Inner per page from the master grid; Inter 3.1 mm × px/mm (no minimum), 400, lh 1.4, #232220, tabular-nums; painted after the parent frames and under the spread frames; spread 0 right page only; Skip first, Start at and Format applied. Not in spread-list thumbnails.
- [ ] `uikit/src/sandbox/v7.tsx`: master Page numbers section without the dead "Position · Bottom" row; position seg + hint "Starts at 1 · 1, 2, 3 · Book settings" only when Show is on (the link opens Book settings); `#` chip on the big master canvas at the folio box in the folio font; Book settings "Page numbers" section between Binding and Print (Start at 1–999, Format 1/i/I, Skip first page, note line).
- [ ] `uikit/scripts/demo-capture.mjs`: step `editor-book-page-numbers`; `uikit/scripts/qa.mjs`: kit10 asserts (Position pill gone, seg hidden when off, folio x per position, none on page 1 with skip, none in thumbnails, Book settings section order).
- **Browser check:** kit `#/demo`, A5, Master A margins 15 mm, Show on: at Fit the folio top is 573.95 of 601.6 px, Outer ink 42.97 px from each outer edge, Inner ink 42.98 px from the spine (±0.5 px, DOM measured); Book settings PRINT header moves 554.70 → 734.07 px.

## Done when

- At Fit for A5, 15 mm margins: folio top 573.95 of 601.6 px; Outer ink 42.97 px from each outer edge; Inner ink 42.98 px from the spine (±0.5 px, DOM measured, numbers in the PR).
- Book settings PRINT header moves 554.70 → 734.07 px.
- `pnpm uikit:qa:quick` green; no folios in spread-list thumbnails.
