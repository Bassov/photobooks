## Decisions

1. `moveFrames` goes through `transformFrames` (locked skipped, one `updateSpread`); `moveFrame` delegates to it. Core has no clamping, so per frame it equals folding `moveFrame`. Label "Move N frames"; the editor sends unlocked ids only.
2. Group move is a third session kind in `frameGesture.ts`, started by a body press on a frame of a 2+ selection (filled or empty). The union rect of the moving frames snaps (`snapRect`) against anchors that exclude the selection, clamped to the spread; Shift locks the dominant axis.
3. Preview is direct DOM writes: a `translate()` per moving frame (rotation kept) and the group box's inline box in the same handler; no commit until release, one `moveFrames` on pointerup; Esc restores, selection kept.
4. Arrows with 2+ selected: one `moveFrames` per press, always `preventDefault`; all locked → `STATUS_FRAME_LOCKED`.
5. Reuses part-1 group box and selection chrome; no new tokens; no kit, `SpreadView` or `ConnectedSpreadView` change. `ui-review` covers empty / happy / interact e2e.

## Touch-set & Test Plan

| File                                    | Why                                   |
| --------------------------------------- | ------------------------------------- |
| `src/core/ops/transform.ts`             | `moveFrames`                          |
| `src/core/ops/applyBookOp.ts`           | op                                    |
| `src/editor/bookHistory.ts`             | label                                 |
| `src/editor/frameGesture.ts`            | group move                            |
| `src/editor/frameHandleGesture.ts`      | set nudge                             |
| `src/core/ops/transform.test.ts`        | PBT                                   |
| `src/editor/bookHistory.test.ts`        | label                                 |
| `src/editor/frameGesture.test.ts`       | group move, Esc                       |
| `src/editor/frameHandleGesture.test.ts` | set nudge                             |
| `e2e/multi-select.spec.ts`              | Done when 2–3 incl. frame-budget gate |

- Reuse: `transformFrames`, `snapRect`, `spreadContext`, `getFrameSelection`, perf fixture helpers. No gate-config edits.
