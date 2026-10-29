# booklet-imposition

Tag: feature
Milestone: P4
Title: home printing

## Scope

- [ ] Owns the 2-up and 4-up imposition options in the Print dialog (shown once this ships). Pure 2-up saddle-stitch sheet order with blank-page padding; imposed PDF from the page PDF (in the worker)
- [ ] 4-up (duplex) sheet order; sheet-count summary in the Print dialog
- [ ] Duplex printing instructions
- **Perf:** imposition runs in the PDF worker; scenario: edit while imposing — zero LoAF.
- **Browser check:** print an 8–16 page booklet, fold, pages read in order.
- **Kit components:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (imposition 2-up saddle-stitch / 4-up, duplex)`)
- **Demo:** `uikit#/demo` steps 27 `print-options`, 28 `print-options-4up-no-bleed` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** 2-up saddle-stitch and 4-up (duplex) from the Print dialog
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** pdf-export
- **UI kit:** `uikit#/feature/pdf-export` (`uikit/src/features/pages.tsx` page `pdf-export`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PrintDialog (imposition 2-up saddle-stitch / 4-up, duplex)`)
