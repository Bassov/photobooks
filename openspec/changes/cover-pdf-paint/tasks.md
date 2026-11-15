## Implementation

- [x] 1. `coverSheetMarks` in `pdfGeometry.ts` + unit / PBT (fold x = spine edges, every mark outside the bleed box) — `pdfGeometry.test.ts` `coverSheetMarks`, `pdfGeometry.pbt.test.ts` "keeps every cover mark outside the bleed box"
- [x] 2. `coverPhotoAnchor` / `coverPhotoRect` in `pdfGeometry.ts` (core-is-pure: not `coverLayout.ts`) + unit / PBT (covers B; covers B' with bleed; = canvas rect without); `CoverView` anchor from it — `pdfGeometry.test.ts` `coverPhotoRect`, `pdfGeometry.pbt.test.ts` `coverPhotoRect`, `CoverView.test.tsx` "anchors the front photo"
- [x] 3. `paintCoverPdf` (boxes, cloth, photo, back / spine / title text, marks, title, streaming) + pdf-lib parse tests (A5 boxes, cloth = `backFill`, spine glyphs, empty text, skipped photo) — `paintCoverPdf.test.ts`
- [x] 4. Worker `{ cover }` request + round-trip test — `pdf.worker.test.ts` `runPdfCover`

## Manual test scenarios

N/A: no UI (core painter); covered by the pdf-lib parse tests.
