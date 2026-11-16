# pdf-export-kit-pill

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-export-kit-pill
Status: done

## Scope

Item 2 of 4 of `pdf-export` (kit dialog done in `pdf-export-kit`; then core, prod UI). SoT: Designer Spec `shared/design/pdf-export/spec.md` D1, D2, §2.5, §3 "Kit", Must PE4 (2026-11-14).

- [x] Kit Print pill + usePrintRun + breakpoint 1424 + demo steps 27–31 per pdf-export Spec PE4
  - [x] D1 top-bar Print job pill (`demo-print`): the `SiteJobPill` mechanism, icon-only 40 × 32 in rest / running / done / failed; titles "Print" / "Exporting PDF · {p}%" / "PDF ready" / "PDF not exported"; sr-only "Exporting PDF, {tens}%" / "PDF ready" / "PDF not exported"; running = `::before` fill `scaleX(p)`; disabled like Export site (no spreads). Print takes no part in P7 (runs beside Export site / Publish).
  - [x] D2 Export site label hides below 1424 px (`max-[1423.98px]`).
  - [x] `usePrintRun` (shaped like `useExportRun`): the run outlives the dialog (Hide / Esc), done shows 4 s, failed stays until the dialog is opened; the pill reopens the dialog in its current step.
  - [x] `features/pages.tsx` `pdf-export` states: opts-checking, opts-clean, opts-issues, no-bleed, run, run-hidden, done, done-skipped, failed; texts that say 1360 say 1424.
  - [x] `uikit/scripts/demo-capture.mjs` print steps renamed per Spec §3 (`print-options`, `print-options-no-bleed`, `print-running-50pct`, `print-done`, `print-running-hidden`) and the demo baseline captured for them.
- **Done when:** at 1440 (DOM measure, ±0.5 px) Preview 1042.64 · Settings 1144.09 · Export site 1190.09 (112.33 wide) · Print 1308.42 (40) · Publish 1354.42 (73.58), gap 6; at 1423 Export site is 40 wide icon-only, at 1424 labelled. The Print pill is 40 × 32 in every state with the D1 titles; running is checked by paint (clipped screenshot pixels of the fill). Hide at 50 % → the pill fills → done 4 s → rest; failed stays until the pill opens the dialog. Checks in `e2e/kit-pdf-export.spec.ts`; `e2e/kit-in-app-publish.spec.ts` K3 1360 → 1424; every pages.tsx state above reachable; kit qa passes with `uikit/scripts/qa.mjs` unchanged.
- **Hard nos:** no edits to `uikit/scripts/qa.mjs`, `src/**`, `e2e/kit-editor-chrome|credits|library|settings|masters.spec.ts`, `e2e/in-app-publish.spec.ts`, `e2e/design-r26-icon-classes.spec.ts`, `e2e/hosting-*.spec.ts`; no Cancel on the run; no backward compat (Owner 2026-11-02).
- **Perf:** kit only; the run is the existing rAF `useRun` stand-in, lifted out of the dialog.
- **Browser check:** kit `#/demo` → Print → Export PDF → Hide at ~50 %: the Print pill fills, then shows a check 4 s and returns to the printer icon; with `__printDemo.fail()` the pill shows a warning until clicked, which opens the failed step; at a 1423 px window Export site is icon-only.
- **UI kit:** `uikit/src/demo-parts/editor.tsx` top bar, `uikit/src/demo-parts/dialogs.tsx` PrintDialog (UI ref: uikit#/feature/pdf-export).
