## Implementation

- [x] 1. `usePrintRun` + PrintDialog `run` prop (follows the run while open, failed text from the run). Evidence: `e2e/kit-pdf-export.spec.ts` PE3 / PE4 run tests.
- [x] 2. Top bar: Print as `SiteJobPill` with `PRINT_PILL`; Export site breakpoint `max-[1423.98px]`; DemoEditor owns the run, the pill reopens the dialog; `EditorView` `print` pill. Evidence: "PE4 top bar at 1440", "PE4 Print pill …", "PE4 failed pill …", K3 1424 / 1423.
- [x] 3. `features/pages.tsx` `pdf-export` states (opts-checking, opts-clean, opts-issues, no-bleed, run, run-hidden, done, done-skipped, failed) and 1424 texts. Evidence: "PE4 #/feature/pdf-export: every state is reachable".
- [x] 4. `demo-capture.mjs` print steps renamed per Spec §3; capture the walk. Evidence: 81 steps, no page errors, `48-print-options` … `52-print-running-hidden` in `.cache/agent/demo-branch`.
- [x] 5. e2e: `kit-pdf-export.spec.ts` PE4 checks; `kit-in-app-publish.spec.ts` K3 1424. Evidence: both specs green locally (chromium channel), `test:e2e:changed:quiet` OK.

## Manual test scenarios

1. Kit `#/demo` → new book → Print → Export PDF → Hide: the Print pill fills, shows a check for 4 s, then the printer icon.
2. `__printDemo.fail()` → Print → Export PDF → Close: the pill shows a warning; clicking it opens "PDF not exported".
3. New book (empty frames): the Print pill rests as a printer icon, title "Print", 40 × 32, enabled like Export site (a kit book can't reach 0 spreads, the disabled case).
4. Window 1423 px: Export site icon-only; 1424 px: labelled.

Results (agent `manual-qa` can't drive the kit; kit-only evidence):

- OK 1 — demo walk step `52-print-running-hidden` paints the half fill; e2e "PE4 Print pill" checks fill pixels 190 / 215, done → rest after > 3 s.
- OK 2 — e2e "PE4 failed pill stays until the pill opens the dialog" (still failed after 4.5 s; the click opens "The disk is full.").
- OK 3 — e2e "PE4 Print pill": rest 40 × 32, title "Print", two Printer icons (sizer + live).
- OK 4 — e2e K3 1424 shown / 1423 hidden (40 wide).
- OK kit qa — `uikit:qa:quick` 338 passed, 0 failed, `qa.mjs` unchanged. ui-review: pass (reused SiteJobPill tokens, aria-label + sr-only status, reduced-motion fill, status by icon + title, not colour only).
