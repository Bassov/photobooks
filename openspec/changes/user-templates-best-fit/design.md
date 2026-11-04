## Decisions

1. `bestLayout(book, spreadIndex, photos, saved)` returns the winning builtin id or `SavedTemplate`; `bestTemplateId` (same args) returns its id. Candidates in order: 6 builtins, the smallest contact sheet, then `saved` with `pages` = the spread's page count, in save order. Saved slot classes = `slotAspect` of `customLayoutRects` (target trim). Same score `[mismatches, spare slots]`; only a strictly smaller score wins, so ties keep the earlier candidate.
2. The op `insertSpreadWithAssets` gains a required `templates: readonly SavedTemplate[]`; `src/core` stays pure and the op replays from its payload. A builtin winner goes through `applyTemplate`, a saved one through `applyCustomLayout(…, slots, pages)`.
3. Best-fit callers: only `src/core/ops/fill.ts` (`insertSpreadWithAssets`). `src/editor/multiDrop.ts` `dropAssets` passes `getSavedTemplates()` on a gap drop; `src/editor/galleryDrop.ts` calls `dropAssets`, unchanged. Frame drop (`fillSpread`) picks no template.

## Touch-set & Test Plan

| File                                      | Why                                     |
| ----------------------------------------- | --------------------------------------- |
| `src/core/templates/best.ts`              | saved candidates                        |
| `src/core/templates/best.test.ts`         | strictly better wins, ties, wrong shape |
| `src/core/templates/best.pbt.test.ts`     | PBT ×1000: same invariants              |
| `src/core/templates/slotAspects.test.ts`  | builtin-only calls pass `[]`            |
| `src/core/templates/slotGeometry.test.ts` | same                                    |
| `src/core/ops/fill.ts`                    | apply the winner                        |
| `src/core/ops/fill.test.ts`               | saved winner applied, filled            |
| `src/core/ops/applyBookOp.ts`             | op payload `templates`                  |
| `src/editor/multiDrop.ts`                 | pass `getSavedTemplates()`              |
| `src/editor/multiDrop.test.ts`            | gap drop picks a saved template         |

- Reuse: `customLayoutRects`, `slotAspect`, `applyCustomLayout`, `getSavedTemplates`.
- e2e: `e2e/multi-drop-fill.spec.ts` unchanged and green.
