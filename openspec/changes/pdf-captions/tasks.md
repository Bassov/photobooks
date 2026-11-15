## Implementation

- [x] 1. Shared text layout in core (`src/core/pdf/textLayout.ts`): styles, `breakTextLines`, ellipsis, baseline, frame / caption / folio placement; render imports it (`textLayout.test.ts`, `textLayout.pbt.test.ts`).
- [x] 2. Book fonts in the PDF (`src/core/pdf/pdfFonts.ts`): woff2 faces at the style weight, unicode-range runs, kerned `TJ`, one subset per face written after the last page (`pdfFonts.test.ts`).
- [x] 3. `paintBookPdf` sets text frames, master items, folios and photo captions in paint order; the worker fetches the font files (`paintPdf.text.test.ts`, `pdf.worker.test.ts`).

## Manual test scenarios

N/A: no UI. Line-break parity with Chromium checked by hand on the caption fixtures (see PR body).
