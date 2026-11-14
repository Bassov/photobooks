## Implementation

- [ ] 1. `usePrintRun` + PrintDialog `run` prop (follows the run while open, failed text from the run).
- [ ] 2. Top bar: Print as `SiteJobPill` with `PRINT_PILL`; Export site breakpoint `max-[1423.98px]`; DemoEditor owns the run, the pill reopens the dialog; `EditorView` `print` pill.
- [ ] 3. `features/pages.tsx` `pdf-export` states (opts-checking, opts-clean, opts-issues, no-bleed, run, run-hidden, done, done-skipped, failed) and 1424 texts.
- [ ] 4. `demo-capture.mjs` print steps renamed per Spec §3; capture the walk.
- [ ] 5. e2e: `kit-pdf-export.spec.ts` PE4 checks; `kit-in-app-publish.spec.ts` K3 1424.

## Manual test scenarios

1. Kit `#/demo` → new book → Print → Export PDF → Hide: the Print pill fills, shows a check for 4 s, then the printer icon.
2. `__printDemo.fail()` → Print → Export PDF → Close: the pill shows a warning; clicking it opens "PDF not exported".
3. New book (empty frames): the Print pill rests as a printer icon, title "Print", 40 × 32, enabled like Export site (a kit book can't reach 0 spreads, the disabled case).
4. Window 1423 px: Export site icon-only; 1424 px: labelled.
