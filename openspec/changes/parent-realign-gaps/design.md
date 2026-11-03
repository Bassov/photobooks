## Decisions

1. `realignResolvedGrids(before, after)` in `src/core/ops/grid.ts` re-aligns (via `realign`) the spreads whose resolved margins / gutters (`FRAME_FIELDS` of `mergeLayoutGrid`) differ. Values, not parent identity: a gridless parent re-aligns nothing; columns / rows only draw the overlay.
2. `removeParent` ends with `realignResolvedGrids(book, next)` (stored id → None and dropped default both covered).
3. New `setDefaultParent(book, parentId | null)` in `parentSpreads.ts` + BookOp: `null` removes the default; an unknown id or the current default leaves the book; stored `parentId` values stay.
4. Undo / redo and `addParent` need no re-align (snapshot frames match their own state; a new parent has no grid); `setSpreadParent` already re-aligns (#418).

## Touch-set & Test Plan

| Path                                     | Why                                         |
| ---------------------------------------- | ------------------------------------------- |
| `src/core/ops/grid.ts`                   | `realignResolvedGrids`                      |
| `src/core/parentSpreads.ts`              | `removeParent` re-align, `setDefaultParent` |
| `src/core/ops/applyBookOp.ts`            | `setDefaultParent` op                       |
| `src/core/ops/grid.test.ts`              | tests                                       |
| `docs/roadmap/P2/parent-realign-gaps.md` | item filled from the bug brief              |

- Unit (reusing `bookWithMasters` / `offGrid` / `changedIds` / painter fixture): delete stored / default gridded master, gridless master, new / cleared default, no-op cases, 40-spread counts.
- PBT: `removeParent` / `setDefaultParent` join the "every templated spread aligned" op mix. No e2e (no UI); perf grid-edit scenario re-run.
