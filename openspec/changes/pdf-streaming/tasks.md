## Implementation

- [x] 1. `pdfStream.ts` streaming writer + PBT (valid xref offsets for random page counts)
- [x] 2. `paintBookPdf` streams photos and sheets (`onChunk`), `imposePdf` streams sheets
- [x] 3. PDF worker chunk protocol (transferred), impose from a `Blob`
- [x] 4. `openExport` + `runPrint` writes chunks as they arrive, aborts on failure
- [x] 5. `SiteJobPill` status derived in render (PrintButton flake); `PrintButton.test.tsx` 20/20
- [x] 6. Peak ArrayBuffer measure: 40-spread painter book, 159 × 4.4 MB JPEGs, single and 2-up

## Manual test scenarios

1. Print → Export PDF (1 per sheet) on the painter fixture: PDF ready, Open PDF opens it. OK — no UI change; covered by `e2e/print-dialog.spec.ts` (export writes the PDF to `exports/`, done step) and `e2e/print-perf.spec.ts` (40-spread PDF, 0 LoAF); 17 passed.
2. Print → 2-up: PDF ready, the `-2up` file opens. OK — `e2e/print-dialog.spec.ts` booklet-imposition (2-up and 4-up files, imposing step) and the print-perf impose gate (0 LoAF).

## Security Review

Worker: only our module worker is posted to; chunk `ArrayBuffer`s are transferred, done carries no PDF. FSA: writes stay in `<library>/exports/` of the user-granted folder, file name is `pdfFileName`'s slug + `.pdf`; a missing folder fails as `access`; abort keeps a previous file. No object URLs, no new dependencies. No findings.
