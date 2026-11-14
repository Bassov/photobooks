## Implementation

- [x] 1. `paintBookPdf`: required `marks` (bleed + crop marks or trim size) and `onSheet` progress callback, padding pages included. (`paintPdf.test.ts` `paintBookPdf marks`)
- [x] 2. PDF worker: required `marks` on the paint request; post `{ progress: { painted, sheets } }` per sheet before `done`. (`pdf.worker.test.ts` progress PBT)
- [x] 3. Tests: marks on / off boxes and paths (paintPdf), progress PBT and `marks` pass-through (worker); every `paintBookPdf(` caller passes `marks`.

## Manual test scenarios

N/A: no UI (core only; the Print dialog item pdf-export covers the browser).
