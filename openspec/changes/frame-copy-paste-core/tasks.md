## Implementation

- [ ] 1. `src/core/ops/clipboard.ts`: `FramesPayload`, `framesPayload`, `pastedRects` (D3 / D4 / D8), `stepRepeatOffset`, `nextFrameIds`, `unmatchedPhotoCount`, `pasteFrames` / `duplicateFrames` (D5–D7).
- [ ] 2. `applyBookOp.ts`: `pasteFrames` / `duplicateFrames` ops, `removeFrames` `cut?`; exports in `src/core/index.ts`.
- [ ] 3. Unit tests `clipboard.test.ts` (Done when list) and PBT `clipboard.pbt.test.ts`.
- [ ] 4. Model + commands for both ops in `bookModel.ts`; regression sequence in `sequence.pbt.test.ts`.

## Manual test scenarios

N/A: pure core, no UI (keys come with FC4).
