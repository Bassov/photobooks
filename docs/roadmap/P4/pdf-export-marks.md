# pdf-export-marks

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-export-marks

## Scope

Core part PE5 of the pdf-export Designer Spec (D4, §2.2): what the later Print dialog (pdf-export) needs from the PDF core. No UI.

- [ ] `paintBookPdf` takes a required `marks` input (the "Add bleed and crop marks" checkbox; overrides the profile's crop marks): on = bleed `printBleedMm(book bleed, profile)` + crop marks; off = bleed 0, no crop marks, MediaBox = TrimBox. Every emitted page, blank padding pages included.
- [ ] The PDF worker's paint request carries `marks` and posts one `progress` message `{ painted, sheets }` per painted sheet, without waiting on the main thread, before `done`.
- **Done when:** marks on, bleed 3 mm, A5 book → every page BleedBox = trim + 2 × 3 mm, crop marks drawn; marks off → every page MediaBox = TrimBox = trim, no crop-mark paths, padding pages included; property test: the worker posts exactly `sheets` progress messages, `painted` 1..sheets in order, then `done`; existing paintPdf / worker tests green.
- **Browser check:** N/A (no UI; the Print dialog item pdf-export shows it).
