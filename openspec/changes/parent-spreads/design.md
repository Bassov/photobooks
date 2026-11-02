## Decisions

1. `resolveSpread` emits the parent layer first (`resolveParentFrames` parent + override frames, flagged `parent: true`), then the spread's frames unchanged; memo also keys on the resolved parent. Canvas, spread list and presentation all paint via `getSpreadPaint`, so previews / tiers / missing counts cover parent photos.
2. `SpreadView` paints parent items in one `spread-view-parent-layer` before the spread frames (`absolute; inset 0; z-index 0; pointer-events none` — its own stacking context below every spread frame, ops write `z ≥ 0`). Items use inert thumb markup (no `data-frame-id`, no control): never selected or dragged; clicks fall through to the spread. `dropSpreadsFromBook` skips them; `paintInputKey` adds the parent layer's frame inputs (a parent edit that keeps spread objects is `parent-spreads-perf`).
3. `setSpreadParent(book, spreadId, parentId | null)` replaces `setSpreadMaster`: stores `parentId` only when it differs from what absent resolves to; unknown id or same effective parent → same book. Schema drops `masterId` / `SPREAD_MASTERS`.
4. Inspector "Master" `SegmentedControl` lists `book.parents` by name + None; hidden without parents. Grid inherit line and the read-only Book settings "Default master" label show the real parent. Kit primitives, no new tokens.

## Touch-set & Test Plan

- Files: `src/core/schema.ts`, `src/core/index.ts`, `src/core/ops/spreadLook.ts`, `src/core/ops/applyBookOp.ts`, `src/core/geometry/types.ts`, `src/core/geometry/resolveSpread.ts`, `src/core/testing/painterFixture.ts` (parents "Master A" with one logo, "Master B" empty; no default), `src/render/SpreadView.tsx`, `src/editor/SpreadSections.tsx`, `src/editor/GridSection.tsx`, `src/editor/BookSettingsSection.tsx`, `src/editor/galleryDrop.ts`, `src/editor/bookStore.ts`; existing `masterId` tests updated. Over the brief's ≤6 (PR body explains).
- Tests: unit/PBT `resolveSpread`, `setSpreadParent`; RTL `SpreadView`, `SpreadSections`; e2e `e2e/parent-spreads.spec.ts` on `?fixture=painter`.
