## Decisions

1. Maths follow `uikit/src/sandbox/clipboard.ts` and Designer D3–D8, with these deviations: single page rects are page mm, so the slot offset (+W for a `right` side) is applied on the way in and out; the x / y shift is summed once per rect, so `inPlace` on the source spread returns the exact rects.
2. "Taken" (D3) and the z top use `spreadFrames` (own + override copies).
3. Payload frames are in z order; `bookId` tells D6 / D7 "same book". D7: same book with the asset still present → kept; else `contentHash`, else `sourceRootId` + `relativePath`; else empty. `unmatchedPhotoCount` counts frames that paste empty.
4. Given `ids` must be unique, one per frame and new on the spread, else no-op (like `addFrame`); absent → `nextFrameIds` (exported for FC4).
5. D8: `stepRepeatOffset(book, spreadId, frameIds, last)`; `duplicateFrames` = paste of its own payload at `{dx, dy}`.

## Touch-set & Test Plan

| File                                 | Why                            |
| ------------------------------------ | ------------------------------ |
| `src/core/ops/clipboard.ts`          | payload, rects, paste, helpers |
| `src/core/ops/clipboard.test.ts`     | unit D3–D8                     |
| `src/core/ops/clipboard.pbt.test.ts` | Spec "Core" properties         |
| `src/core/ops/applyBookOp.ts`        | 2 ops + `cut?`                 |
| `src/core/index.ts`                  | exports                        |
| `src/core/testing/bookModel.ts`      | model + commands               |
| `src/core/ops/sequence.pbt.test.ts`  | regression sequence            |

Tests: unit + PBT as above; no e2e (pure core).
