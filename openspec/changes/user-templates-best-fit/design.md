## Decisions

1. `bestLayout(book, spreadIndex, photos, saved)` returns the winning builtin id or `SavedTemplate`; `bestTemplateId` (same args, `saved` required) returns its id as `string`. Candidates in order: the 6 builtins, the smallest contact sheet, then `saved` filtered to `pages === getSpreadPageCount(...)` in save order. Saved slot classes = `slotAspect` of `customLayoutRects(book, spreadIndex, slots)` (the target trim). Same score `[mismatches, spare slots]`; only a strictly smaller score replaces the winner, so ties keep the earlier candidate (builtins first, then save order).
2. The op `insertSpreadWithAssets` gains a required `templates: readonly SavedTemplate[]`. `src/core` stays pure: the editor passes the list, the op replays from its payload. A builtin winner goes through `applyTemplate`, a saved one through `applyCustomLayout(…, slots, pages)`.
3. Best-fit callers: `src/core/ops/fill.ts` (`insertSpreadWithAssets`, via `bestLayout`) is the only one. Wiring: `src/editor/multiDrop.ts` `dropAssets` adds `templates: getSavedTemplates()` to the gap op; `src/editor/galleryDrop.ts` calls `dropAssets` and needs no change. `fillSpread` (frame drop) does not pick a template.

## Touch-set & Test Plan

| File                                  | Why                                                             |
| ------------------------------------- | --------------------------------------------------------------- |
| `src/core/templates/best.ts`          | saved candidates, wider return type                             |
| `src/core/templates/best.test.ts`     | unit: saved wins / tie keeps builtin / wrong shape / save order |
| `src/core/templates/best.pbt.test.ts` | PBT ≥1000 runs: the three invariants                            |
| `src/core/ops/fill.ts`                | op passes saved list, custom apply                              |
| `src/core/ops/fill.test.ts`           | custom winner applied, frames filled                            |
| `src/core/ops/applyBookOp.ts`         | op payload `templates`                                          |
| `src/editor/multiDrop.ts`             | pass `getSavedTemplates()`                                      |
| `src/editor/multiDrop.test.ts`        | gap drop picks a saved template                                 |

- Reuse: `customLayoutRects`, `slotAspect`, `applyCustomLayout`, `getSavedTemplates`.
- e2e: `e2e/multi-drop-fill.spec.ts` unchanged and green.
