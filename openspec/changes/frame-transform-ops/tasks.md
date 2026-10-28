## Implementation

- [x] 1. `moveFrame` / `resizeFrame` / `rotateFrame` / `alignFrames` / `distributeFrames` in `src/core/ops/transform.ts`, wired through `BookOp` / `applyBookOp`, exported from `src/core`
- [x] 2. Unit tests per op: unlocked mutates, locked unchanged, invalid input no-op (`transform.test.ts`)
- [x] 3. Fill `docs/roadmap/M4/frame-transform-ops.md` SoT fields

## Manual test scenarios

N/A (pure ops, no UI)
