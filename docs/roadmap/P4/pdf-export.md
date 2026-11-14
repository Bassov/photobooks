# pdf-export

Tag: feature
Milestone: P4
Title: print PDF
Status: done

## Scope

- [ ] PDF from the Print dialog (top-bar Print pill, Designer Spec `pdf-export` D1–D10): Page size / Printer / Imposition '1 per sheet' read-only rows, a bleed + crop marks **user checkbox** (D4, default on), the D5 summary and a Check block; progress with Hide; PDF ready + Open PDF and "Saved in …/exports." (D9, written to the exports folder); failed with Try again. No imposition segmented, no cancel, no download (kit `PrintDialog` wins, Designer call M8)
- [ ] Peak memory measured on a 40-spread book against a recorded threshold; if above it, do `pdf-streaming`. Threshold: 1 GB peak ArrayBuffer growth; measured 1.4 GB (159 distinct 4.4 MB JPEGs, 78 sheets, 708 MB PDF) — above, `pdf-streaming` follows
- **Perf:** scenario: edit while the PDF builds — zero LoAF.
- **Browser check:** export with and without the bleed checkbox; pages match the editor at trim size; bleed + crop marks only when checked; Open PDF opens the written PDF and the done step names its exports folder.
- **Browser check (from `printer-presets`):** pick a print preset, export a PDF that matches its spec (trim, bleed, page count, spine).
- **Kit components:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
- **Demo:** `uikit#/demo` steps 27 `print-options`, 28 `print-options-4up-no-bleed`, 29 `print-running-50pct`, 30 `print-done`, 31 `print-done-shown-in-folder` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Print dialog: page size, '1 per sheet', bleed + crop marks checkbox, Check block, progress, PDF ready + Open PDF + saved path; 2-up / 4-up **hidden** (not disabled) until `booklet-imposition` owns them
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; editor never freezes during export
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the Print dialog on the `?fixture=` editor; perf scenario: edit while the PDF builds
- **Depends:** pdf-painter, pdf-color-tagging, print-profiles, kit10-editor-chrome
- **UI kit:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
