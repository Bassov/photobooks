# icon-set

Tag: prep
Milestone: M2.5
Title: icons (Security Review: dependency, if a package is chosen)
Status: done

## Scope

- [x] `Icon` primitive with size tokens; ~24 icons (undo, redo, zoom in / out, fit, add spread, duplicate, delete, grid, guides, rulers, text, image, lock, eye, warning, info, check, present, export, settings, chevrons, folder)
- [x] Decision: tree-shaken `lucide` vs in-repo SVG set, recorded in `docs/design.md`; decorative icons `aria-hidden`, icon-only controls require a label
- [x] Specimen section
- **UI ref:** `uikit#/feature/icon-set`

## Done note

Icon primitive + 24 in-repo SVG glyphs; specimen; a11y; no lucide dep
