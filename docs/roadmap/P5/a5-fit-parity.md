# a5-fit-parity

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item a5-fit-parity
Status: done

## Scope

Designer note (parity on #489): at A5 portrait the editor spread at Fit is 828.8 × 588 px in prod vs 848 × 601.61 px in the kit `#/demo`. Measured on 2026-11-06 with the same DOM probe: kit and prod both give 828.8 × 588 at 1440 × 900 (port 928 × 692, height-limited) and both give 848 × 601.61 at 1440 × 920 (port 928 × 712, width-limited). The two numbers come from two window heights; the fit formula, bands and panel widths already match `uikit/src/sandbox/viewport.tsx` `fitScale`. Prod keeps its fit; this item locks the parity in tests.

- [ ] e2e: A5 portrait at 1440 × 900 and 1440 × 920, prod Fit spread = kit numbers ±0.5 px (kit numbers hard-coded, kit measurement path cited)
- [ ] Unit test of `fitSpreadZoomFor` for the A5 portrait case at both port sizes
- **Browser check:** A5 portrait book at Fit, 1440 × 900: spread 828.8 × 588; A4 landscape 848 × 299.8, Square 20 848 × 424, A3 831.59 × 588 (kit = prod, before = after)
- **Done when:** the e2e and unit tests above pass; no prod fit code changes; other formats unchanged (listed in the PR body)
- **Hard nos:** no edits under `uikit/**`, `src/editor/Cover*`, `src/editor/InspectorControls.*`, `src/render/cover*`, `PresentationMode*`, `docs/design.md`; no loosened parity tolerances
- **UI kit:** `uikit#/demo` editor Fit (`uikit/src/sandbox/viewport.tsx` `fitScale`)
