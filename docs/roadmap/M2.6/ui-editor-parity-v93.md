# ui-editor-parity-v93

Tag: feature
Milestone: M2.6
Title: Editor v0.9 hard-no parity with kit

## Scope

- [x] Enforce kit v0.9 hard-nos on the product editor: grayscale chrome; selection tone `#CACACA` (filmstrip/template/spread list); black outline only for canvas frame selection + handles; Space = pan only (no panel hotkeys while held); no Replace button / photo-picker modal; quiet Publish; one Crop entry (inspector)
- [x] Tool cursors and wheel-zoom-to-pointer match kit where the product already has those interactions
- [x] Close remaining visual/parity gaps called out in `uikit/README.md` v0.9.x vs product after `ui-editor-shell-v93`
- **UI kit:** `UI ref: uikit#/full/editor`, `UI ref: uikit#/demo`, `uikit/README.md` (v0.9.0–v0.9.3 hard-nos)
- **Browser check:** On preview, hard-nos hold: no blue chrome, no Replace control, Space pans without toggling panels, filmstrip selection is tone-only, frame selection uses canvas outline
- **Perf:** Parity CSS/cursor changes must not regress editor frame-budget scenarios
- **Size:** ~400–1000 changed lines
- **Source:** Owner package J
