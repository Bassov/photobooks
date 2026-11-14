# pdf-export-kit

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-export-kit
Status: done

## Scope

Item 1 of 4 of `pdf-export` (kit dialog; then kit-pill, core, prod UI). SoT: Designer Spec `shared/design/pdf-export/spec.md` §2.1–2.4 (2026-11-14), decisions D3–D6, D8–D10.

- [x] Kit Print dialog: options, Check block, run/done/failed per pdf-export Spec PE1–PE3
  - [x] PE1 options: imposition segmented kept behind `IMPOSITION = false`; read-only row "Imposition · 1 per sheet" (`print-imposition`); bleed checkbox label from the profile (`print-bleed`, default on); summary per D5 (`PDF · {pages} pages` + ` on {sheets} sheets` when they differ + ` · bleed {b} mm` / ` · trim size, no marks`).
  - [x] PE2 Check block (`print-check`, `data-state` checking / clean / issues): label with error / warning counts, rows (error / warning / info icon, colour, weight), order errors → warnings → info, page lists ≤ 5 then ` +{n}`, list capped at 118.25 px with scroll, error note; Export PDF never disabled.
  - [x] PE3 run / done / failed per §2.2–2.4: run dismissable (Hide, Esc, outside click), "Page {i} of {n} · {p}%" then "Saving · {p}%", 6 px bar, keep-editing hint; done: file · pages · MB, "Saved in {library}/exports.", skipped-photos row, Open PDF (D9) replaces Show in folder, Done; failed: access / full / other texts, Close, Try again.
- **Done when:** the kit dialog values (500 wide, padding 20/24, r14, title Lora 21/26.25 500, buttons 36 h r8) equal the Spec by DOM measure in a new `e2e/kit-pdf-export.spec.ts`, which also reaches every PE1–PE3 state in `#/demo`; the test ids `uikit/scripts/qa.mjs` reads (948-949, 1020-1021, 1085, 1396) are kept and kit qa still passes.
- **Hard nos:** no 2-up / 4-up offered; no "Show in folder" or other dead control; Export PDF never disabled by the check; no edits to `uikit/scripts/qa.mjs`, `uikit/src/demo-parts/editor.tsx`, `uikit/src/features/pages.tsx`, `uikit/scripts/demo-capture.mjs` / the demo baseline (next item), `src/**`.
- **Perf:** kit only, no new interaction in prod; the run is the existing rAF `useRun` stand-in.
- **Browser check:** kit `#/demo` → create a book → Print: rows Page size / Printer / Imposition · 1 per sheet, Check settles to issues; uncheck bleed → "trim size, no marks"; Export PDF → Page i of n · p%, Esc hides; Export PDF again → PDF ready with Open PDF and the saved path.
- **UI kit:** `uikit/src/demo-parts/dialogs.tsx` PrintDialog (UI ref: uikit#/demo, Print in the top bar); partial: the Print job pill and the `pdf-export` feature-page states land with the next item.
