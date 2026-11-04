## Implementation

- [ ] 1. `bestTemplateId` scores saved templates of the target's page count after the builtins; ties keep the earlier candidate (`best.ts`, `best.test.ts`, `best.pbt.test.ts`).
- [ ] 2. `insertSpreadWithAssets` op takes `templates` and applies a custom winner with `applyCustomLayout` (`fill.ts`, `applyBookOp.ts`, `fill.test.ts`).
- [ ] 3. `dropAssets` passes `getSavedTemplates()` on a gap drop (`multiDrop.ts`, `multiDrop.test.ts`).

## Manual test scenarios

N/A: code review only (no visible UI change); `e2e/multi-drop-fill.spec.ts` covers the drop path.
