## Implementation

- [x] 1. `resizeFrameKeepPhoto` in `src/core/ops/transform.ts` (keep-photo crop, Fill anchor clamp, Fit `clampCrop`). — 9517de69
- [x] 2. Op `resizeFrameKeepPhoto` in `applyBookOp.ts`, export from `src/core/index.ts`, `parentOverrides.test.ts` list. — 9517de69, `parentOverrides.test.ts` "frame ops on a local copy"
- [x] 3. Unit cases + PBT in `src/core/ops/transform.test.ts`. — `describe('resizeFrameKeepPhoto')`

## Manual test scenarios

N/A (core op only, no UI; the prod item `direct-crop` covers the browser).
