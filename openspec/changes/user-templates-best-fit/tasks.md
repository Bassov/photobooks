## Implementation

- [x] 1. `bestTemplateId` scores saved templates of the target's page count after the builtins; ties keep the earlier candidate (`best.ts`, `best.test.ts`, `best.pbt.test.ts`). Evidence: `best.test.ts` (strictly better wins, tie keeps builtin, save order, wrong shape), `best.pbt.test.ts` (3 properties × 1000 runs).
- [x] 2. `insertSpreadWithAssets` op takes `templates` and applies a custom winner with `applyCustomLayout` (`fill.ts`, `applyBookOp.ts`, `fill.test.ts`). Evidence: `fill.test.ts` "with saved templates".
- [x] 3. `dropAssets` passes `getSavedTemplates()` on a gap drop (`multiDrop.ts`, `multiDrop.test.ts`). Evidence: `multiDrop.test.ts` "a gap drop picks a saved template that fits better"; `e2e/multi-drop-fill.spec.ts` 5/5.

## Manual test scenarios

N/A: code review only (no visible UI change); `e2e/multi-drop-fill.spec.ts` covers the drop path.
