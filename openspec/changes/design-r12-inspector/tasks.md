## Implementation

- [x] 1. M76 field boxes: `.fit-crop-field` radius 8 + `shadow-xs` (Pan X/Y, X/Y/W/H, Rotation). `src/editor/FitCropSection.css`; e2e `M76: Pan and POSITION & SIZE field boxes…`.
- [x] 2. M76 Caption: panel padding `pt-0.5 pb-3` (input dy 28.25, hint dy 66.25 under the CAPTION title). `src/editor/FrameLookSections.tsx`; unit `bookLookUi.test.tsx`; e2e `M76: the Caption input and hint…`.
- [x] 3. M77 Done: crop toggle keeps `shadow-xs` in crop mode. `.fit-crop-toggle`; unit `Inspector.test.tsx`; e2e `M77: Crop and Done carry the kit shadow-xs`.
- [x] 4. Unit tests for the class hooks; `e2e/design-r12-inspector.spec.ts` with kit values measured on `uikit#/demo` at 1440x900 (90/90 with `--repeat-each=30`).

## Manual test scenarios

1. Select a photo frame at 1440x900: Pan and Geometry boxes show the soft shadow and 8 px corners; open Caption: input and hint line up with the kit.
2. Press Crop: the "Done" button shows the kit shadow; press Done to leave crop mode.

`pnpm agent manual-qa --change design-r12-inspector` (2026-11-02):

- 1: problem (harness): `start-session` click intercepted by the welcome header; scenario not reached. Covered by e2e `M76: Pan and POSITION & SIZE field boxes…` and `M76: the Caption input and hint…`.
- 2: problem (harness): same welcome block. Covered by e2e `M77: Crop and Done carry the kit shadow-xs`.
