## Implementation

- [x] 1. Core: six kit layouts in `TEMPLATE_IDS` + `generateTemplateFrames`, with unit tests.
- [x] 2. Picker catalog (`layoutCatalog.ts`): kit order and names, plus summary names for every fixed id.
- [x] 3. Kit thumb (`layoutThumb.ts` + markup/CSS): paper box, clamped slots, spine; tile and caption styles = kit.
- [x] 4. `Disclosure` summary / right; Layout header = kit Section with a "Save as template" `+` (enabled when the spread has frames, see 10); Sparkles on Suggested; kit hint; Suggested capped at 3.
- [x] 5. Hover preview store + `TemplatePreviewOverlay` on the active spread.
- [x] 6. Preview mode mounts no frame controls / overlays (M25).
- [x] 7. Inspector header row = kit `InspectorShell` (icon, title, meta, PanelRightClose).
- [x] 8. e2e `design-r2-layout-picker.spec.ts` + `preview-no-overlays.spec.ts`; move existing specs off `2-up` / `4-grid`.
- [x] 9. Core: `customLayoutRects` / `spreadLayoutSlots` / `applyCustomLayout`; `Spread.masterId` + `setSpreadMaster` / `setSpreadBackground` ops, with unit tests.
- [x] 10. `savedTemplates.ts` store (localStorage, `?templates=kit` DEV / test-fixture seed); `+` and "Save as template" enabled, inline rename, tile menu, real tab counts.
- [x] 11. `SpreadSections.tsx`: Master & spacing (kit SliderValueField) and Background; Grid renamed; Inspector order = kit.
- [x] 12. e2e: kit section order, All 13 / My templates 3, save → My templates + All → reload, section boxes and writes.

## Manual test scenarios

- Select spread 2–3: the Layout section matches `#/demo` step 14; hover Full bleed → dashed preview + "Preview · Full bleed"; leave → gone.
- Select a frame, turn on the grid, open Preview: no handles / size tag / grid; Esc → frame still selected.

Results (headless, 1440×900, 4× CPU; `pnpm agent manual-qa` stopped at its own smoke step: the hidden 1 px `start-session` button sits under the welcome header, unrelated to this change):

- OK spread 2–3 selected; All layouts in kit order (Full bleed … Landscape + 2 portraits).
- OK hover Full bleed → dashed preview + "Preview · Full bleed"; leave → preview gone.
- OK perf: hovering five tiles, 0 long animation frames (3 runs).
- OK Preview: 0 handles / size tag / grid / pressed frames.
- OK Esc → the frame (spread-2-f0) still selected with 8 handles; inspector still Photo.
- Problem (pre-existing, not this change): after Preview the canvas is back at spread 1, since `EditorShell` unmounts the Pasteboard while presenting and it re-fits on mount.

Round 2 (saved templates, spread sections; Chromium 1440×900 against `#/demo` on the kit dev server and the product dev / test build):

- OK empty: new user → "My templates 0"; My templates tab → "No templates yet. Save a spread you like." on one line (e2e bounding box).
- OK happy: `?templates=kit` → "All 13 / My templates 3", kit order; section titles Layout, Master & spacing, Background, Grid; section boxes = kit (Master & spacing 300 × 170.59, Background 300 × 95, Grid 300 × 176.53; value field 64 × 16.8, track 268 × 3 at +24.8 px).
- OK interact: `+` on spread 2–3 → inline name, Enter → My templates 1 / All 11 → reload keeps it; Margin 12 → four margins 12 mm; Gap 99 → 20 mm; dark swatch → spread 2–3 paints rgb(42, 41, 39).
- Note: the product's Contact sheet row (layout-geometry spec) stays under "Save as template"; it is the only product-only row (+44 px vs the kit).
