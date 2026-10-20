# jpeg-spreads-export

Tag: feature
Milestone: M6
Title: JPEG spreads

## Scope

- [ ] One sRGB JPEG per spread at profile size and DPI, rendered and encoded in the worker; zipped or written to a folder
- **Perf:** scenario: edit while JPEG spreads encode — zero LoAF.
- **Browser check:** export JPEG spreads for a jpeg-spreads profile; pixel size matches the profile; colors match the editor.
- **UI ref:** `uikit#/feature/jpeg-spreads-export`
- **UI kit:** `uikit/src/features/m6m8.tsx:322` (`jpeg-spreads-export` demo + notes), `UI ref: uikit#/feature/jpeg-spreads-export` — JPEG spreads export dialog
