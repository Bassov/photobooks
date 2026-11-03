## Implementation

- [x] 1. `realignResolvedGrids` in `src/core/ops/grid.ts` (re-align spreads whose resolved frame grid changed). Evidence: `grid.test.ts` "parent changes re-align the spreads whose grid changes".
- [x] 2. `removeParent` re-aligns through it; unit tests in `grid.test.ts` (stored + default fallback, other masters untouched, overrides kept, 40-spread count). Evidence: "deleting the default master…", "deleting a stored master…", "deleting a master without a grid…" (fail with the re-align removed).
- [x] 3. `setDefaultParent` core op + BookOp (an undo step like every non-gallery op); unit tests (only unset spreads re-align, no-op cases, 40-spread count). Evidence: "a new default…", "clearing the default…", "the current default, an unknown id…", "switching to or deleting the default master re-aligns all 40 painter spreads".
- [x] 4. Extend the grid-ops alignment PBT with `removeParent` / `setDefaultParent`. Evidence: "after any op sequence every templated spread matches its effective grid".

## Manual test scenarios

N/A — core-only change, no UI (Book settings default parent is a read-only pill; Masters Delete is covered by unit tests through `applyBookOp`).
