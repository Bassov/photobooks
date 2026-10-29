# pdf-export

Tag: feature
Milestone: P4
Title: print PDF

## Scope

- [ ] PDF from the Print dialog: page size from the book (read-only), '1 per sheet', 'Add 3 mm bleed and crop marks' as a **user checkbox**; progress; PDF ready + Show in folder (written to the exports folder). No cancel, no download (kit `PrintDialog` wins, Designer call M8)
- [ ] Peak memory measured on a 40-spread book against a recorded threshold; if above it, do `pdf-streaming`
- **Perf:** scenario: edit while the PDF builds — zero LoAF.
- **Browser check:** export with and without the bleed checkbox; pages match the editor at trim size; bleed + crop marks only when checked; Show in folder opens the exports folder.
- **Kit components:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
- **Demo:** `uikit#/demo` steps 27 `print-options`, 28 `print-options-4up-no-bleed`, 29 `print-running-50pct`, 30 `print-done`, 31 `print-done-shown-in-folder` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Print dialog: page size, '1 per sheet', bleed + crop marks checkbox, progress, PDF ready + Show in folder; 2-up / 4-up **hidden** (not disabled) until `booklet-imposition` owns them
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; editor never freezes during export
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the Print dialog on the `?fixture=` editor; perf scenario: edit while the PDF builds
- **Depends:** pdf-painter, pdf-color-tagging, print-profiles, kit10-editor-chrome
- **UI kit:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (editor top bar "Print")`)
