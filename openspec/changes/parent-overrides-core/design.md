## Decisions

1. Ops in `parentSpreads.ts` take the parent item id; overrides accept an optional copy `id` (the canvas selects it), else `copy-<n>`. Empty override lists are dropped, so override → reset is identity.
2. `update.ts` adds `findSpreadFrame` / `withChangedCopies`; `updateFrame` and the core frame ops reach copies, only own-frame edits detach the template. Z-order and `removeFrames` stay own-only. Placements and gallery removal include copies.
3. `keepOverridesAsOwn`: copies by z go below the lowest own z, `overridesId` dropped; copy guides become own. Run by `setSpreadParent`, `removeParent`, `setDefaultParent` on spreads whose parent changes.
4. Perf: `bookStore.paintChanged` compares a spread's painted parent frames (minus suppressed ids) by element identity. Resolver already filters hidden ids.

## Touch-set & Test Plan

| Path                                     |
| ---------------------------------------- |
| `src/core/parentSpreads.ts`              |
| `src/core/update.ts`                     |
| `src/core/index.ts`                      |
| `src/core/ops/applyBookOp.ts`            |
| `src/core/ops/spreadLook.ts`             |
| `src/core/ops/transform.ts`              |
| `src/core/ops/frames.ts`                 |
| `src/core/ops/arrange.ts`                |
| `src/core/ops/fill.ts`                   |
| `src/core/ops/place.ts`                  |
| `src/core/ops/crop.ts`                   |
| `src/core/ops/frameLook.ts`              |
| `src/core/ops/gallery.ts`                |
| `src/core/selectors/placements.ts`       |
| `src/editor/bookHistory.ts`              |
| `src/editor/bookStore.ts`                |
| `src/testFixtures/loadPainterFixture.ts` |
| `e2e/parent-spreads-perf.spec.ts`        |

- Reuse: `updateSpread`, `omitKey`, `spreadParent`, `detached`, fast-check arbitraries in `src/core/testing/`.
- Tests: PBT `src/core/parentSpreads.test.ts` (≥1000 runs: override→reset identity, hide→reset identity, hide hides, frame ops reach copies, parent switch keeps copies as own frames in order); `bookStore.parentOverrides.test.ts` dispatch + labels + notify only the spread / skip suppressed; perf e2e `&overrides=10`.
