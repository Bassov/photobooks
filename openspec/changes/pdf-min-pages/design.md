## Decisions

1. New pure `blankSheets(spreadCount, minPages, trim, output)` in `src/core/pdf/pdfGeometry.ts`: the book's pages are `pagesOf(spreadCount)` (the count `printIssues` uses); it returns the sheets for `max(0, minPages − pages)` blank pages, `spreadIndex` past the last spread. `'pages'` → one trim-wide sheet per page; `'spreads'` → two-page sheets, an odd remainder ends on one single-page sheet. The PDF has exactly `max(pages, minPages)` pages.
2. `paintBookPdf` appends them after the last book page with `profile.pageCount.min`.
3. Page setup (media, bleed, trim boxes) moves into one `addSheetPage` shared by book and blank sheets; a blank sheet gets crop marks iff `profile.cropMarks`, nothing else. `PaintPdfResult.sheets` counts blank sheets too.
4. `pdf.worker.ts` is fixed through the painter, unedited; tests are the only other callers.

## Touch-set & Test Plan

| Path                                   | Why                                       |
| -------------------------------------- | ----------------------------------------- |
| `src/core/pdf/pdfGeometry.ts`          | `blankSheets`                             |
| `src/core/pdf/paintPdf.ts`             | append blank sheets, `addSheetPage`       |
| `src/core/pdf/pdfGeometry.test.ts`     | `blankSheets` examples                    |
| `src/core/pdf/pdfGeometry.pbt.test.ts` | PBT page total, whole sheets              |
| `src/core/pdf/paintPdf.test.ts`        | 4-page book on min 20, at-min, crop marks |
| `docs/roadmap/P4/pdf-min-pages.md`     | fill stub item                            |

- Reuse: `pagesOf`, `sheetBoxes`, `paintCropMarks`.
- Tests: unit reads the PDF (`getPageCount`, boxes, empty blank pages, crop-mark operators iff `cropMarks`); PBT on `paintBookPdf` page count = `max(pages, min)` for `'pages'` profiles and on `blankSheets` for both outputs; no e2e.
