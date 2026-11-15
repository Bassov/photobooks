## Implementation

- [ ] 1. `pdfStream.ts` streaming writer + PBT (valid xref offsets for random page counts)
- [ ] 2. `paintBookPdf` streams photos and sheets (`onChunk`), `imposePdf` streams sheets
- [ ] 3. PDF worker chunk protocol (transferred), impose from a `Blob`
- [ ] 4. `openExport` + `runPrint` writes chunks as they arrive, aborts on failure
- [ ] 5. `SiteJobPill` status derived in render (PrintButton flake); `PrintButton.test.tsx` 20/20
- [ ] 6. Peak ArrayBuffer measure: 40-spread painter book, 159 × 4.4 MB JPEGs, single and 2-up

## Manual test scenarios

1. Print → Export PDF (1 per sheet) on the painter fixture: PDF ready, Open PDF opens it.
2. Print → 2-up: PDF ready, the `-2up` file opens.
