## Implementation

- [x] 1. Override / hide / reset ops in `src/core/parentSpreads.ts` + `BookOp` cases + exports; PBT in `src/core/parentSpreads.test.ts`
- [x] 2. Frame ops reach `parentOverrides.frames` (`update.ts` helpers, transform / frames / arrange / fill / place / crop / frameLook); copy photos count as placements and leave with the gallery
- [x] 3. Parent change keeps the work (`setSpreadParent`, `removeParent`, `setDefaultParent`)
- [x] 4. `bookHistory` undo labels; `bookStore` skips spreads whose painted parent frames are unchanged; bookStore unit tests
- [x] 5. Painter fixture `&overrides=10`; 40/10 LoAF gate in `e2e/parent-spreads-perf.spec.ts`; `SpreadView.parent.test.tsx` and `e2e/parent-spreads.spec.ts` stay unchanged

## Manual test scenarios

N/A (no UI; perf gate and unit tests cover the change).
