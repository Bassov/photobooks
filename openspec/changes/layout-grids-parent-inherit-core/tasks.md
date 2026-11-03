## Implementation

- [x] 1. Tests first: core cases in `grid.test.ts` / `spreadLook.test.ts`, history step test, PBT in `layoutGrid.test.ts` (11 failed before the fix; painter master edit re-aligned 0 of 40 spreads).
- [x] 2. `grid.ts`: `editGridOverride` for spread and master ids; `setBookGrid` by `gridFieldSource`; export `realign` (`grid.test.ts` master / setBookGrid describes, op-sequence PBT).
- [x] 3. `resetSpreadGridFields` op (`grid.ts`, `applyBookOp.ts`) and its `Reset grid value` label (`grid.test.ts` resetSpreadGridFields, `bookHistory.test.ts`).
- [x] 4. `setSpreadParent` re-aligns its spread (`spreadLook.test.ts` re-align case).
- [x] 5. GP8 gate: the 40-spread master grid scenario also edits the gutter and checks the frames moved on all 40 spreads (`e2e/parent-spreads-inspector.spec.ts`, 0 LoAF locally); GP7 browser check test (39 of 40, None untouched).

## Manual test scenarios

N/A — core only, no UI change; the browser check is the GP7 e2e test and GP8 gate on `?fixture=painter&parent=a`.
