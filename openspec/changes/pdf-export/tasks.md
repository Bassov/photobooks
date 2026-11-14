## Implementation

- [ ] 1. Generic `jobStore` (export site moves onto it) + `printStore` + `printText` with unit tests.
- [ ] 2. `startPrint` (`runPrint`, `checkPrint`, retry, Open PDF) + `getOpenLibraryHandle`; unit test on the written PDF bytes (bleed on / off).
- [ ] 3. `PrintButton` in the top bar between Export site and Publish; Export site label breakpoint 1424.
- [ ] 4. `PrintDialog` steps opts (+ Check) / run / done / failed with RTL tests.
- [ ] 5. e2e `print-dialog.spec.ts`, top-bar positions; `design-r11-topbar` P11 → 1424.
- [ ] 6. Perf scenario `print-perf.spec.ts`; 40-spread peak memory measured and recorded in the roadmap item; item text to the Spec wording.

## Manual test scenarios

1. Open a library book, Print → options + Check, Export PDF, Hide, keep editing, pill fills, PDF ready, Open PDF.
