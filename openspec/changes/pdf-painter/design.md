## Decisions

1. **Place:** `src/core/pdf/` (print model is `src/core/print/`; no new capability). Pure geometry (`pdfGeometry.ts`), painter (`paintPdf.ts`), worker entry (`pdf.worker.ts`) and its factory (`createPdfWorker.ts`).
2. **Sheets:** profile `output: 'pages'` → one PDF page per book page (a two-page spread splits at the trim width); `'spreads'` → one PDF page per spread. Spreads come from `resolveSpread`, so parents, crop and turns match the canvas.
3. **Boxes:** bleed = the book's `bleedMm` clamped to the profile's bleed range. TrimBox = trim, BleedBox = trim + bleed; MediaBox = BleedBox, or, when `profile.cropMarks`, trim + mark offset (`max(bleed, 3 mm)`) + 5 mm marks. Content is clipped to the BleedBox.
4. **Photos:** each asset is embedded once (JPEG as its original bytes, DCTDecode; PNG via pdf-lib; others skipped and reported). A photo is drawn under `cm` matrices: frame (rotation about its centre) → clip to the frame rect → image matrix that mirrors `turnedPhotoStyle` (quarter turns, straighten, flips, crop window) and the EXIF orientation of the raw JPEG.
5. **Security / bundle:** the worker receives `Blob`s by `postMessage`, returns PDF bytes as a transferred `ArrayBuffer`; the library is a dynamic `import()` in `paintPdf.ts`, so it lands in its own chunk; nothing in the editor imports `src/core/pdf/`.

## Touch-set & Test Plan

| File                              | Why                                                                    |
| --------------------------------- | ---------------------------------------------------------------------- |
| `src/core/pdf/pdfGeometry.ts`     | pure sheets, boxes, matrices, crop marks                               |
| `src/core/pdf/paintPdf.ts`        | pdf-lib painter                                                        |
| `src/core/pdf/pdf.worker.ts`      | worker entry                                                           |
| `src/core/pdf/createPdfWorker.ts` | worker factory                                                         |
| `package.json`                    | new deps (Owner Q-14)                                                  |
| `pnpm-lock.yaml`                  | new deps                                                               |
| `knip.json`                       | ignore `@pdf-lib/fontkit` until `pdf-captions` imports it (Owner Q-14) |

- Reuse: `resolveSpread`, `getSpreadPageCount`, `bookPrintProfile`, `makePainterFixture`.
- Tests: unit + PBT on `pdfGeometry` (boxes, matrices vs `turnedPhotoStyle` corners, orientation); painter unit test on the fixture book (page count per output, boxes, byte-equal JPEG streams, one XObject per asset, crop marks); worker + factory unit tests. No e2e (no UI).
