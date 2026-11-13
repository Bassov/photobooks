## Implementation

- [x] 1. Add `@cantoo/pdf-lib` and `@pdf-lib/fontkit` (Owner Q-14), alone in the first commit. (f1858420; `pnpm audit:ci` clean)
- [x] 2. `pdfGeometry.ts`: sheets per profile output, Trim/Bleed/MediaBox, crop-mark segments, frame / image matrices (crop, turns, flips, EXIF orientation); unit + PBT. (`pdfGeometry.test.ts`, `pdfGeometry.pbt.test.ts`)
- [x] 3. `paintPdf.ts`: embed each photo once (original JPEG bytes), clip + transform, page background, crop marks only when the profile asks; fixture-book unit test. (`paintPdf.test.ts`: 78 pages, byte-equal DCTDecode streams)
- [x] 4. `pdf.worker.ts` + `createPdfWorker.ts`: Blobs in, transferred PDF bytes out; unit tests. (`pdf.worker.test.ts`, `createPdfWorker.test.ts`)
- [x] 5. Roadmap follow-up `pdf-frame-looks` (frame stroke / mat / radius in the PDF). (`docs/roadmap/P4/pdf-frame-looks.md`)

## Manual test scenarios

N/A (prep, no UI; the PDF is checked by unit tests).
