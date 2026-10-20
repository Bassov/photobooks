# pdf-export

Tag: feature
Milestone: M6
Title: print PDF

## Scope

- [ ] Pages or spreads per the profile's `output`; progress, cancel, download
- [ ] Peak memory measured on a 40-spread book against a recorded threshold; if above it, do `pdf-streaming`
- **Perf:** scenario: edit while the PDF builds — zero LoAF.
- **Browser check:** download the PDF for a pages profile and a spreads profile; pages match the editor at trim size with bleed; no crop marks unless the profile asks.
- **UI ref:** `uikit#/feature/pdf-export`
- **UI kit:** `uikit/src/features/m6m8.tsx:321` (`pdf-export` demo + notes), `UI ref: uikit#/feature/pdf-export` — print PDF export dialog
