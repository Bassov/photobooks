## Decisions

1. Native HTML5 DnD with a private MIME (`application/x-photobooks-spread`), same family as `galleryDrop`; keeps current listbox DOM/testids (RAC DnD would rewrite them).
2. Drop index = pure fn of pointer Y vs item midpoints (`spreadReorder.ts`); one `moveSpread` op on drop = one history step.
3. Live feedback by `transform: translateY` on items between source and target; insertion line uses `--select`, keyboard focus `--ring` (docs/design.md; no new tokens); dragged item dimmed. Rects are stored relative to list content and `scrollTop` is added, so list scroll mid-drag stays correct.
4. Keyboard: Alt+↑/↓ on a focused item dispatches `moveSpread`; focus follows the item.
5. `moveSpread` reapplies templates for spreads whose page count changed (reuse `reapplyChangedPageRoles`).
6. Re-template already works via `applyTemplate` (rebinds frames by index; extras become unplaced) — lock with tests only.

## Touch-set & Test Plan

- Files: `src/core/ops/spreads.ts`, `src/editor/SpreadsPanel.tsx`, new `src/editor/spreadReorder.ts`, `src/editor/EditorShell.css`.
- Reuse: `dispatchBookOp`, `moveSpread`, `applyTemplate`.
- Tests: unit for `moveSpread` page roles + PBT (permutation preserves ids/assets); `spreadReorder` target fn incl. scrollTop; panel drag/keyboard (jsdom); applyTemplate keeps order/overflow. e2e `e2e/spread-reorder.spec.ts`: drag reorder + pasteboard follows + undo; single spread not draggable; scroll stays in `spreads-list`; retemplate keeps photos. Skill `ui-review` on SpreadsPanel.
