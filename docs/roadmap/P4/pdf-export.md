# pdf-export

Tag: feature
Milestone: P4
Title: print PDF

## Scope

- [ ] Pages or spreads per the profile's `output`; progress, cancel, download
- [ ] Peak memory measured on a 40-spread book against a recorded threshold; if above it, do `pdf-streaming`
- **Perf:** scenario: edit while the PDF builds — zero LoAF.
- **Browser check:** download the PDF for a pages profile and a spreads profile; pages match the editor at trim size with bleed; no crop marks unless the profile asks.
- **Kit components:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
- **Demo:** `uikit#/demo` steps 27 `print-options`, 28 `print-options-4up-no-bleed`, 29 `print-running-50pct`, 30 `print-done`, 31 `print-done-shown-in-folder` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Print dialog: page size, imposition 1 / 2-up / 4-up for duplex, 3 mm bleed + crop marks, progress, PDF ready + Show in folder
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; editor never freezes during export
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** pdf-painter, pdf-color-tagging, kit10-editor-chrome
- **UI kit:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
