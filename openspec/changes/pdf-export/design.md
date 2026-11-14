## Decisions

1. Generic `createJobStore` (Export site moves onto it); `printStore` is a module singleton, so a run outlives the dialog and a top-bar remount.
2. `startPrint` takes injected deps (snapshot, marks, library handle, photo resolver, worker runner, `writeExport`); one PDF `Worker` per `paint` / `check` request, terminated after its last message. Main thread only resolves `File` handles (no reads) and writes; `print-perf` gates LoAF.
3. Library root from `projectSession.getOpenLibraryHandle()` (readwrite since bind). Open PDF: `getFile()` → blob URL, `_blank`, opener cut, revoked after 60 s.
4. A session book without a library fails with the access text (no Spec rule).
5. UI: `SiteJobPill`, `Dialog`, `Button md`, `Checkbox`, `ProgressBar`, `Icon` (docs/design.md); skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                     |
| ---------------------------------------- |
| `src/editor/export/jobStore.ts`          |
| `src/editor/export/exportSiteStore.ts`   |
| `src/editor/export/exportSiteGlyphs.tsx` |
| `src/editor/export/SiteJobPill.tsx`      |
| `src/editor/export/ExportSiteButton.css` |
| `src/editor/print/printStore.ts`         |
| `src/editor/print/printText.ts`          |
| `src/editor/print/startPrint.ts`         |
| `src/editor/print/PrintButton.tsx`       |
| `src/editor/print/PrintDialog.tsx`       |
| `src/editor/print/PrintDialog.css`       |
| `src/editor/EditorTopBar.tsx`            |
| `src/editor/projectSession.ts`           |
| `e2e/print-dialog.spec.ts`               |
| `e2e/print-perf.spec.ts`                 |
| `e2e/fixtures/printJob.ts`               |
| `e2e/design-r11-topbar.spec.ts`          |
| `docs/roadmap/P4/pdf-export.md`          |

- Tests: unit for store, texts, `runPrint` written bytes (bleed on / off); RTL for pill and dialog; e2e + perf per tasks.
