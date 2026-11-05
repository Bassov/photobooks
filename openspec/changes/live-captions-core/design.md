## Decisions

1. `resolveText.ts`: anchored templates read photo tokens from the anchor frame in `spread.frames` (rules in the spec delta). Unanchored templates are unchanged: `{title}` = book title, other photo tokens empty.
2. `frames.ts`: `setTextLive` / `setTextAnchor` act only on own text frames of a book spread. `defaultAnchor` = smallest `hypot` of the axis gaps, photos first, ties → lower index. Off resolves with `resolveTextContent`.
3. `applyBookOp`: the switch moves to `applyRaw`; `normaliseAnchors(before, after)` visits spreads not in `before` by identity and freezes a bad anchor with text resolved on the `before` frame. `duplicateSpread` keeps frame ids → no remap.
4. `bookHistory.ts`: labels `Make caption live` / `Make caption static` / `Anchor caption`; no coalescing.
5. `jpegHeadPass`: one `patchAssetRecord` with `capturedAt?` and `meta ?? {}` when either is missing.

## Touch-set & Test Plan

| Path                                      | Why         |
| ----------------------------------------- | ----------- |
| `src/core/text/resolveText.ts`            | tokens      |
| `src/core/ops/frames.ts`                  | ops         |
| `src/core/ops/applyBookOp.ts`             | normalise   |
| `src/editor/bookHistory.ts`               | labels      |
| `src/editor/jpegHeadPass.ts`              | store meta  |
| `src/assets/extractAssetMetadata.ts`      | camera      |
| `src/core/schema.ts`                      | comment     |
| `src/core/text/textFrame.test.ts`         | unit + PBT  |
| `src/core/ops/liveCaptions.test.ts`       | unit        |
| `src/core/ops/textFrames.test.ts`         | editText    |
| `src/editor/liveCaptions.pbt.test.ts`     | op/undo PBT |
| `src/editor/jpegHeadPass.test.ts`         | unit        |
| `src/assets/extractAssetMetadata.test.ts` | unit        |
| `src/editor/bookHistory.test.ts`          | unit        |

Reuse: `updateFrame`, `checkBookInvariants`, `recordStep` / `undoStep` / `redoStep`, fixtures. e2e: none (no UI).
