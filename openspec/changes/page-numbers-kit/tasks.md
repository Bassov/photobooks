## Implementation

- [x] 1. `model.ts`: `Doc.pageFormat`, `MASTER_POS` + `pageNumberPosOf`, `FOLIO_SAFE`, `folioBox` / `formatPageNumber` / `foliosOf`; Master A "Folio" frames → one "Chapter" frame. Evidence: kit qa "page-numbers-kit: spread folios follow Outer / Centre / Inner …".
- [x] 2. `canvas.tsx`: one folio branch (canvas + Preview) under the spread frames, per the Designer look; `docs/design.md` folio line. Evidence: same qa line (`under`, 3.1 mm, #232220) + "no folios in the spread list".
- [x] 3. `v7.tsx` master section: drop Position row; seg + hint (Book settings link) only when on; `syncGrids` sets `MASTER_POS`; `#` chip at the folio box (big canvas only). Evidence: qa "v7 Pages/Masters toggle …" (seg off/on, no Position row) + "master hint links to Book settings".
- [x] 4. `v7.tsx` Book settings: Page numbers section (Start at, Format, Skip first page, note) between Binding and Print. Evidence: qa "… section between Binding and Print, 179.37 px" + "Start at 5 + i, ii, iii + Skip first page …".
- [x] 5. `demo-capture.mjs` step `editor-book-page-numbers`; `qa.mjs` kit10 asserts. Evidence: demo walk 71 steps (36 = `editor-book-page-numbers`), kit qa 361 passed / 0 failed.

## Manual test scenarios

1. Kit `#/demo`, A5, Master A margins 15, Show on: folio top / Outer / Inner px at Fit (DOM measured).
2. Book settings: Start at 5, i/ii/iii, Skip first page → spread folios vi / vii; PRINT header y before / after.

DOM probe (kit dist, 1440 × 900, Fit 2.8649 px/mm, spread 848 × 601.61; OK lines):

- OK 1: folio top 573.91 of 601.61 (target 573.95), h 12.42, 8.88 px, rgb(35, 34, 32), tabular-nums. Outer ink 42.97 / 42.98 px from the outer edges; Inner ink 42.98 / 42.97 px from the spine; Centre ink centres ≈ 212 / 636. `#` chips 8.88 px Inter. 0 folios in the spread list.
- OK 2: Start at 5 + i, ii, iii + Skip → pages 2–3 "vi, vii", page 1 none, note "Page 1 has no number · page 2 is vi". Kit PRINT 512.70 → 692.08 (+179.37, Master A on, one-line note); with no master on the note wraps to two lines (+194.22, PRINT 706.92).
