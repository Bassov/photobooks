## Implementation

- [x] 1. Generic `jobStore` (export site moves onto it) + `printStore` + `printText` with unit tests. — `jobStore.test.ts`, `exportSiteStore.test.ts`, `printStore.test.ts`, `printText.test.ts` pass.
- [x] 2. `startPrint` (`runPrint`, `checkPrint`, retry, Open PDF) + `getOpenLibraryHandle`; unit test on the written PDF bytes (bleed on / off). — `startPrint.test.ts` (trim 148 mm, bleed box +6 mm, media past bleed; off: MediaBox = TrimBox), `projectSession.test.ts`.
- [x] 3. `PrintButton` in the top bar between Export site and Publish; Export site label breakpoint 1424. — `PrintButton.test.tsx`, `EditorTopBar.test.tsx`.
- [x] 4. `PrintDialog` steps opts (+ Check) / run / done / failed with RTL tests. — `PrintDialog.test.tsx`.
- [x] 5. e2e `print-dialog.spec.ts`, top-bar positions; `design-r11-topbar` P11 → 1424. — 15/15 local, `test:e2e:changed:quiet` OK.
- [x] 6. Perf scenario `print-perf.spec.ts`; 40-spread peak memory measured and recorded in the roadmap item; item text to the Spec wording. — `print-perf: 0 LoAF []`; peak +1.4 GB vs 1 GB threshold (above → `pdf-streaming`).

## Manual test scenarios

1. Open a library book, Print → options + Check, Export PDF, Hide, keep editing, pill fills, PDF ready, Open PDF.
   - problem (harness): `pnpm agent manual-qa` stopped at the welcome screen (`start-session` click intercepted by the header); the walk did not reach the editor. The same flow is covered by `e2e/print-dialog.spec.ts` "Export → Hide → the pill fills → PDF ready → Open PDF" and `e2e/print-perf.spec.ts` (drag + zoom during the build, 0 LoAF), both green locally.
