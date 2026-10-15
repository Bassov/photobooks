# Design

## Context

See proposal.md. `applyTemplate` already rebinds `assetId` and crop by index and drops frames past the new template (`src/core/templates/apply.ts`). Gallery membership is unchanged. The Placed badge follows placement count. `setEditorStatus` / `getEditorStatus` feed the existing polite region in `EditorShell` (`data-testid="editor-status"`). `SpreadTemplateBar` only dispatches `applyTemplate`.

## Goals / Non-Goals

**Goals:**

- Announce removed placements on that dispatch, with one sentence, and leave the status alone when the count is zero.
- Lock the existing rebind with a public `applyTemplate` test. Do not change rebind.

**Non-Goals:**

- Announcements from `addSpread` when it re-applies a template after a page-count change.
- A new live region, scrollport, or status store.

## Decisions

1. **Count overflow placements in the editor dispatch, not in `applyTemplate`.** After `dispatchBookOp` applies an `applyTemplate` op and the book reference changes, count previous frames at index `>=` the new frame length that have an `assetId`. That matches index rebind: kept slots copy the photo; the tail is dropped; empty tail frames do not count. If the count is at least one, call `setEditorStatus`. If it is zero, do not call it, including when an earlier message is already set. A no-op reapply returns the same book and returns before any status write. Alternative: return a count from `applyTemplate` — rejected because placement behavior and its return stay as they are.

2. **One sentence helper on the existing status module.** `unplacedFromSpreadStatus(count)` in `src/editor/editorStatus.ts` returns `1 photo was unplaced from the spread` when count is 1, and `` `${count} photos were unplaced from the spread` `` otherwise. The bar does not format copy. `bookStore.ts` and `editorStatus.ts` are already on the mutation allow-list; do not add mutate paths.

3. **Tests use public APIs and shared arrange.** Domain: `applyTemplate` from `4-grid` to `one-per-page` on a one-page spread keeps the asset ids that still have slots, drops the rest, and leaves every id in `gallery`. Editor: `dispatchBookOp({ type: 'applyTemplate', ... })` plus `getEditorStatus` for a shrink (singular and plural sentences) and for a change that drops nothing after `setEditorStatus` with a prior message. Reuse `makeBook`, `makeSpread`, `makeFrame`, `addToGallery`, and `placeAsset`. If both suites would copy that arrange, add one helper in `src/core/testing/fixtures.ts`.

4. **e2e locks the three observables. No new scrollport.** `e2e/template-unplace.spec.ts` uses `photo-file-input`, the Spread template radios, `filmstrip-placed`, and `editor-status`, plus `assertDocumentFitsViewport`. Empty: empty gallery, choose `4-grid`, zero Placed badges, empty status, document fits. Happy interact: on the active one-page spread, place two photos on `4-grid`, choose `one-per-page`, both items stay in the filmstrip, exactly one Placed badge remains, status is `1 photo was unplaced from the spread`. Prior status: unplace so the region reads `Photo unplaced`, then switch between `full-bleed` and `one-per-page` (one slot each); the status stays `Photo unplaced`. Skill `ui-review` (including layout smoke) runs before push.

## Risks / Trade-offs

- [Same photo on two dropped frames counts twice] → The sentence reports placements, which matches the spec.
- [Status and book are separate stores] → Set the status only after the book update so a failed no-op cannot announce.

## Touch-set

- `src/editor/editorStatus.ts`, `src/editor/bookStore.ts`
- `src/editor/editorStatus.test.ts`, `src/editor/bookStore.test.ts`, `src/core/templates/templates.test.ts`
- `src/core/testing/fixtures.ts` only if the arrange is shared
- `e2e/template-unplace.spec.ts`
- `docs/roadmap.md` — add the `template-unplace-notice` checkbox after `drag-swap-unplace` and tick it at archive
- Delta: `openspec/changes/template-unplace-notice/specs/editor-shell/spec.md`

## Migration Plan

None. Rollback is reverting the dispatch status write.
