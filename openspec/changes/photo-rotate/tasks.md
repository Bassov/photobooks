## Implementation

- [x] Cover math with straighten + quarter turns (`cropRotation.test.ts`)
- [x] Crop ops keep rotation (`crop.test.ts`)
- [x] Painter turned layout + preview layer (`SpreadView.rotate.test.tsx`)
- [x] Inspector Rotate section + keys (`PhotoRotateSection.test.tsx`)
- [x] e2e + perf gate (`e2e/photo-rotate.spec.ts`)

## Manual test scenarios

- Rotate a sideways photo 90°, straighten a tilted horizon, reload: OK (covered by `e2e/photo-rotate.spec.ts`).
