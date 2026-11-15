## Decisions

1. **Control:** kit block "Imposition (duplex)" over `SegmentedControl` md (`docs/design.md` primitives, `--field` track, label `LABEL`); dialog-local state like bleed; `data-testid="print-imposition"` in kit and prod.
2. **Home paint:** a 2-up / 4-up job paints with a copy of the book's profile (`output: 'pages'`, `pageCount.min: 0`), so the page PDF has one page per book page.
3. **Impose:** then the existing worker `impose` request through the same `runPdfWorker` (page PDF transferred); painting and imposing stay in the PDF worker. Progress: paint 0–80 %, impose 80–95 %.
4. **Duplex text** on PDF ready only, so options never shift.
5. **Fixture:** `?fixture=painter&spreads=<n>`; pages are even, so 14 pages stand in for 13 (same 4 / 2 sheets).

## Touch-set & Test Plan

| File                                     | Why                      |
| ---------------------------------------- | ------------------------ |
| `src/editor/print/PrintDialog.tsx`       | control, summary, duplex |
| `src/editor/print/printStore.ts`         | imposing event, layout   |
| `src/editor/print/printText.ts`          | texts                    |
| `src/editor/print/startPrint.ts`         | home paint, impose, file |
| `src/core/print/pdfFileName.ts`          | `-2up` / `-4up`          |
| `src/testFixtures/loadPainterFixture.ts` | `&spreads=`              |
| `uikit/src/demo-parts/dialogs.tsx`       | IMPOSITION on            |
| `uikit/src/demo-parts/printCheck.ts`     | kit imposing progress    |
| `uikit/src/features/pages.tsx`           | 2-up / 4-up states       |
| `uikit/scripts/demo-capture.mjs`         | step 28 4-up             |
| `e2e/print-dialog.spec.ts`               | booklet page counts      |
| `e2e/fixtures/printJob.ts`               | `readExportBytes`        |
| `e2e/print-perf.spec.ts`                 | edit while imposing      |
| `e2e/kit-pdf-export.spec.ts`             | kit control              |

No gate config edits. Unit: texts, store, `runPrint` (in-process worker), file name, dialog, fixture. e2e: default, 2-up / 4-up happy, Export interact; skill `ui-review` before push.
