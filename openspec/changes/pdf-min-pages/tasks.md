## Implementation

- [x] 1. `blankSheets` in `pdfGeometry.ts` with unit + PBT (both outputs, odd spread deficit) — `pdfGeometry.test.ts` "adds blank sheets up to the minimum…", `pdfGeometry.pbt.test.ts` "blank sheets lift the book…"
- [x] 2. `paintBookPdf` appends blank sheets counted with `pagesOf`; shared `addSheetPage`; crop marks iff `profile.cropMarks` — `paintPdf.ts`
- [x] 3. `paintPdf.test.ts`: 4-page book on min 20 → 20 pages with page-1 boxes, blank content; at/above min unchanged; PBT page count = `max(pages, min)` — "paintBookPdf below the profile minimum"

## Manual test scenarios

N/A — PDF bytes only, no UI (unit tests read the PDF).
