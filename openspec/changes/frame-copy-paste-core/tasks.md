## Implementation

- [x] 1. `src/core/ops/clipboard.ts`: `FramesPayload`, `framesPayload`, `pastedRects` (D3 / D4 / D8), `stepRepeatOffset`, `nextFrameIds`, `unmatchedPhotoCount`, `pasteFrames` / `duplicateFrames` (D5–D7). (37eceb2f)
- [x] 2. `applyBookOp.ts`: `pasteFrames` / `duplicateFrames` ops, `removeFrames` `cut?`; exports in `src/core/index.ts`. (37eceb2f)
- [x] 3. Unit tests `clipboard.test.ts` (Done when list) and PBT `clipboard.pbt.test.ts`. (37eceb2f)
- [x] 4. Model + commands for both ops in `bookModel.ts`; regression sequence in `sequence.pbt.test.ts`. (37eceb2f)

## Manual test scenarios

N/A: pure core, no UI (keys come with FC4).
