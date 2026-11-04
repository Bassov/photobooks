## Decisions

1. `PageNumberPosition = 'outer' | 'centre' | 'inner'`; read back from the `-pn-l` align, `null` without it.
2. Rects follow the Designer table from the parent's effective grid, then x is clamped on its page to `[safe, P − safe − 20]` (roadmap "rect inside safe for margins 0–40").
3. `syncPageNumbers(book)` re-derives every parent's items (same object when equal); `applyBookOp` wraps `setTrim` and the four grid ops with it. Safe margin has no op. Editor callers all dispatch through `applyBookOp` (listed in the PR).
4. `setPageNumbering` clamps `start` to 1–999 and ignores non-finite values; equal values return the same book.
5. `ResolvedSpread.folios` lives in the structural cache, keyed additionally on `pageNumbering` and the parent's `pageNumbers`; page 1 shifts x by −P like `viewGuides`.
6. Undo: `HistorySnapshot.pageNumbering` + `moveHistory` restore.

## Touch-set & Test Plan

| Path                                   | Why                     |
| -------------------------------------- | ----------------------- |
| `src/core/pageNumbers.ts`              | new pure module         |
| `src/core/pageNumbers.test.ts`         | unit + PBT              |
| `src/core/ops/applyBookOp.ts`          | two ops, sync wraps     |
| `src/core/geometry/types.ts`           | `folios?` (add only)    |
| `src/core/geometry/resolveSpread.ts`   | fill folios (add only)  |
| `src/core/index.ts`                    | exports (add only)      |
| `src/editor/bookHistory.ts`            | snapshot field, labels  |
| `src/editor/bookStore.ts`              | restore `pageNumbering` |
| `src/editor/bookStore.history.test.ts` | undo test               |

- Reuse: `effectiveGrid`, `parentAsSpread`, `updateParentSpread`, `makeBook`.
- Tests: Done when of the item, plus a clamped case (margin < safe) and sync idempotence. No e2e (no UI).
