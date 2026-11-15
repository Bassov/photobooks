## Implementation

- [x] 1. Core: `pdfFileName` layout suffix; painter fixture `&spreads=<n>` (unit tests). — `pdfFileName.test.ts` "adds the booklet layout"; `painterFixture.test.ts` "keeps the first n spreads".
- [x] 2. Texts + store: layouts, imposed counts, "Imposing sheets" run text, done "N sheets", duplex instructions, `imposing` event and 80 / 95 % split (unit tests). — `printText.test.ts`, `printStore.test.ts` "paints a booklet to 80 %…".
- [x] 3. `runPrint`: home profile paint, worker `impose` with the page PDF transferred, `-2up` / `-4up` file, layout in the outcome (unit tests with the in-process worker). — `startPrint.test.ts` "imposes a 2-up booklet…", "imposes a booklet in a second worker…".
- [x] 4. Print dialog: Imposition (duplex) segmented, summary per layout, done duplex line (component tests). — `PrintDialog.test.tsx` "counts paper sheets for a booklet…", "shows a booklet imposing…".
- [x] 5. Kit: `IMPOSITION = true`, same texts, feature states (2-up, 4-up no bleed, imposing, PDF ready 2-up), demo step 28 `print-options-4up-no-bleed`. — `e2e/kit-pdf-export.spec.ts` booklet + feature-states tests.
- [x] 6. e2e: 8- and 14-page books 2-up / 4-up exported file page counts; kit control; perf gate "edit while imposing". — `e2e/print-dialog.spec.ts` `booklet-imposition` (4 / 8 / 2 / 4 PDF pages), `e2e/print-perf.spec.ts` impose gate: 0 LoAF.

## Manual test scenarios

1. Open Print on a book, pick 2-up: summary says "on N sheets"; Export PDF → run shows "Imposing sheets"; PDF ready shows "N sheets" and the flip-on-short-edge text; Open PDF shows two pages per side.
2. Leave 1 per sheet: the run and PDF ready read as before (pages, no duplex text).
3. Pick 4-up with bleed off: summary "trim size, no marks"; PDF ready shows the cut-across text.
