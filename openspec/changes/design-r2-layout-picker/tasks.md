## Implementation

- [ ] 1. Core: six kit layouts in `TEMPLATE_IDS` + `generateTemplateFrames`, with unit tests.
- [ ] 2. Picker catalog (`layoutCatalog.ts`): kit order and names, plus summary names for every fixed id.
- [ ] 3. Kit thumb (`layoutThumb.ts` + markup/CSS): paper box, clamped slots, spine; tile and caption styles = kit.
- [ ] 4. `Disclosure` summary / right; Layout header = kit Section with a disabled "Save as template" `+`; Sparkles on Suggested; kit hint; Suggested capped at 3.
- [ ] 5. Hover preview store + `TemplatePreviewOverlay` on the active spread.
- [ ] 6. Preview mode mounts no frame controls / overlays (M25).
- [ ] 7. Inspector header row = kit `InspectorShell` (icon, title, meta, PanelRightClose).
- [ ] 8. e2e `design-r2-layout-picker.spec.ts` + `preview-no-overlays.spec.ts`; move existing specs off `2-up` / `4-grid`.

## Manual test scenarios

- Select spread 2–3: the Layout section matches `#/demo` step 14; hover Full bleed → dashed preview + "Preview · Full bleed"; leave → gone.
- Select a frame, turn on the grid, open Preview: no handles / size tag / grid; Esc → frame still selected.
