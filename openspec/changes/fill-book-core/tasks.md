## Implementation

- [x] 1. `fill.ts`: factor `insertFilledSpread` out of `insertSpreadWithAssets`; add `FillBookPlan`, `planFillBook`, `fillBook` (48d9d317).
- [x] 2. `applyBookOp.ts` op `fillBook`; `index.ts` exports (48d9d317; `fill.test.ts` "is reachable through applyBookOp with saved layouts").
- [x] 3. Unit cases in `fill.test.ts` (`describe('fillBook')`) and the PBT in `fillBook.pbt.test.ts`.
- [x] 4. Spec delta `layout-geometry`: Fill book op.

## Manual test scenarios

N/A: core only, no UI (kit FB1 and prod FB3 are later items).
