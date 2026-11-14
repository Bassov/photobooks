## Implementation

- [ ] 1. `photoPages(book)` in `preflight.ts` on the shared printed-item loop
- [ ] 2. `preflightRows` + `pageList` in `src/core/print/preflightText.ts` (unit + PBT)
- [ ] 3. `pdfFileName(title, trimMm)` in `src/core/print/pdfFileName.ts` (unit)
- [ ] 4. Worker `check` request (`runPdfCheck`, ≤ 256 KB colour reads) and tagged request dispatch
- [ ] 5. `writeExport(root, name, bytes)` in `src/project/fsa/writeExport.ts` (in-memory folder tests)

## Manual test scenarios

N/A: core only, no UI (the Print dialog item drives it).
