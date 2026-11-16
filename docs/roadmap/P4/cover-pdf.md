# cover-pdf

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-pdf
Status: done

## Scope

- [x] Print dialog Options (Designer cover-pdf §2.1, C8): Cover row `print-cover` between Printer and Imposition, `{sheetW/10} × {sheetH/10} cm · spine {spine} mm` with 1 per sheet (A5 `33.8 × 24 cm · spine 12 mm`), `None with booklets` with 2-up / 4-up; bleed label `(cover {c} mm)` only when the cover bleed differs; summary `PDF · {pages} pages + cover · …` with 1 per sheet
- [x] Check (C9): cover rows (`scope: 'cover'`) only with 1 per sheet; label and error note count the visible rows
- [x] Exporting (§2.2, C1): 1 per sheet writes the pages PDF, then `<library>/exports/{pdfCoverFileName}` through the worker `cover` request; units = sheets + 1, `Cover · {p}%`, then `Saving · {p}%`; booklets unchanged, no cover file
- [x] PDF ready (§2.3, C10): `print-done-cover` line, skipped row counts the front photo (` · cover, pages …`), `Open pages` · `Open cover` · Done; booklets `Open PDF`; a failure of either file = the failed step, Try again re-runs both
- [x] Spine paint (C5): the editor cover spine (canvas, sheet gradient, mini covers) paints `backFill`; the fixed `--cover-spine` token goes
- **Browser check:** A5 book at 1440×900: Cover row `33.8 × 24 cm · spine 12 mm`, rows below at the kit's offsets; 1 per sheet export writes `…-cover.pdf` (one page) next to the pages PDF, Open cover opens it; 2-up writes no cover file; the canvas spine pixels = `backFill` (#3E3C3B by default)
- **UI ref:** `uikit#/full/pdf-export` (kit `demo-parts/dialogs.tsx` PrintDialog)
- **Done when:** print-dialog e2e prod-vs-kit geometry green with the Cover row (0.5 px rows); two files in `exports/` with 1 per sheet, none extra with booklets; canvas spine = backFill by paint check; painting stays in the PDF worker; `pnpm roadmap check` green
- **Kit components:** none (kit done in cover-pdf-kit)
- **Demo:** n/a
- **Musts:** CP4
- **Hard nos:** no uikit/** edits; no core painter changes; no main-thread painting
- **Tokens:** `--cover-spine` removed
- **Test:** unit (PrintDialog, printText, printStore, startPrint) + e2e print-dialog, kit10-cover
- **Depends:** cover-pdf-kit, cover-pdf-paint, cover-pdf-check
