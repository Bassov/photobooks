## Implementation

- [x] 1. `coverLayout(geometry)` percent layout, `frontDropFrom`, `sameCoverGeometry` + unit tests.
- [x] 2. `CoverView` layer stack (sheet, cover box, photo layer, hinge, safe frames, veil, chip), spine text rule, labels under the sheet; memo on `cover` + `geometry`.
- [x] 3. `CoverCanvas` stable selectors and sheet drop limited to the front board + its band; `PresentationMode` props.
- [x] 4. `CoverSection` head sub and Spine width hint; ppi on the front photo box.
- [x] 5. `docs/design.md` cover line.
- [x] 6. Update the existing unit and e2e tests (Designer spec "Tests → Update").
- [x] 7. New `e2e/cover-editor.spec.ts` with its frame-budget perf describe.

## Manual test scenarios

1. Select the cover: sheet with veiled band, hinge strips, two dashed safe frames, "Wrap 15 mm" chip; spine text centred.
2. Book settings Pages 20 → 60 → 120: spine widens, text stays centred.
3. Drag a filmstrip photo to the right band: photo fills the front and the band; drag to the back board: refused.

Manual QA (`pnpm agent manual-qa`, 2026-11-05): harness problem on all three: the `start-session` click is intercepted by the welcome header before the editor opens. Covered instead by `e2e/cover-editor.spec.ts`: (1) band 30.14 px, chip, overlays `pointer-events: none`, spine text centred; (2) Pages 20 / 60 / 120 → spine 24.11 / 39.44 / 61.39 px, centred both directions; (3) front-band drop sets the photo (`elementsFromPoint` + pixel change), back-band drop refused.
