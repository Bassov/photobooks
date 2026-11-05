## Implementation

- [x] 1. `resolveText.ts`: `{date}` / `{title}` / `{caption}` / `{camera}` from the anchored photo, part dropping, `—`; update `textFrame.test.ts` cases + new unit / PBT. — `src/core/text/textFrame.test.ts` (`live caption tokens`), a611c542
- [x] 2. `frames.ts`: `editText` keeps the content type; `setTextLive`, `setTextAnchor`, default anchor; unit tests. — `src/core/ops/liveCaptions.test.ts`, `textFrames.test.ts`, a611c542
- [x] 3. `applyBookOp.ts`: op cases + anchor normalisation after every op; `bookHistory.ts` labels; unit tests. — `liveCaptions.test.ts` (`anchor normalisation`), `bookHistory.test.ts`, a611c542
- [x] 4. PBT: random user ops with undo / redo never trip `bad-text-anchor`. — `src/editor/liveCaptions.pbt.test.ts`, a611c542
- [x] 5. `jpegHeadPass.ts` stores `meta` (`{}` when none, read once); `readCamera` dedupe; unit tests. — `jpegHeadPass.test.ts`, `extractAssetMetadata.test.ts`, a611c542

## Manual test scenarios

N/A — no visible UI change (code review only).
