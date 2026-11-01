## Implementation

- [ ] 1. M76 field boxes: `.fit-crop-field` radius 8 + `shadow-xs` (Pan X/Y, X/Y/W/H, Rotation).
- [ ] 2. M76 Caption: panel padding `pt-0.5 pb-3` (input dy 28.25, hint dy 66.25 under the CAPTION title).
- [ ] 3. M77 Done: crop toggle keeps `shadow-xs` in crop mode.
- [ ] 4. Unit tests for the class hooks; `e2e/design-r12-inspector.spec.ts` with kit values measured on `uikit#/demo` at 1440x900.

## Manual test scenarios

1. Select a photo frame at 1440x900: Pan and Geometry boxes show the soft shadow and 8 px corners; open Caption: input and hint line up with the kit.
2. Press Crop: the "Done" button shows the kit shadow; press Done to leave crop mode.
