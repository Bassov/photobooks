## Implementation

- [x] 1. `src/core/print/imposition.ts`: 2-up / 4-up sheet order, padding, sheet count + unit and PBT tests (`imposition.test.ts`, `imposition.pbt.test.ts`; e00f635e).
- [x] 2. `src/core/pdf/imposePdf.ts`: imposed PDF from the page PDF + read-back test (8 / 13 pages, blank source page; `imposePdf.test.ts`; e00f635e).
- [x] 3. `src/core/pdf/pdf.worker.ts`: `impose` request, progress / done / failed messages + worker tests (`pdf.worker.test.ts` `runPdfImpose`; e00f635e).
- [x] 4. Fill `docs/roadmap/P4/booklet-imposition-core.md` scope from the brief (e00f635e).

## Manual test scenarios

N/A — no UI in this item (Print dialog options come with `booklet-imposition`).
