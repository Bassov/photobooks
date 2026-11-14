## Implementation

- [x] 1. `photoPages(book)` in `preflight.ts` on the shared printed-item loop (`preflight.test.ts` "photoPages")
- [x] 2. `preflightRows` + `pageList` in `src/core/print/preflightText.ts` (`preflightText.test.ts`, `preflightText.pbt.test.ts`)
- [x] 3. `pdfFileName(title, trimMm)` in `src/core/print/pdfFileName.ts` (`pdfFileName.test.ts`)
- [x] 4. Worker `check` request (`runPdfCheck`, ≤ 256 KB colour reads) and tagged request dispatch (`pdf.worker.test.ts` "runPdfCheck")
- [x] 5. `writeExport(root, name, bytes)` in `src/project/fsa/writeExport.ts` (`writeExport.test.ts`)

## Manual test scenarios

N/A: core only, no UI (the Print dialog item drives it).
