## Decisions

1. The app scrolls natively, so rulers anchor to the active spread's on-screen rect (not a kit pan origin); kit tick math lives in pure `rulersMath`.
2. One `<canvas>` per axis, repainted in rAF from scroll / committed camera / resize. Spine and cursor tick are DOM nodes moved imperatively; the pointer listener sits on `pasteboard-stage` and hides on leave.
3. Visibility: editor-only store `rulersView.ts` (default off); top-bar `RulersToggle` and `Shift+R` in `installEditorGridKeys` (typing guard).
4. `pasteboard-stage` wraps scroll + rulers; rulers on → scroll inset 22 px, strips `pointer-events: none` (no guide cursors).

## Touch-set & Test Plan

- Files: `src/editor/` `rulersMath.ts`, `rulersView.ts`, `Rulers.tsx` / `.css`, `RulersToggle.tsx`, `Pasteboard.tsx`, `EditorTopBar.tsx`, `installEditorGridKeys.ts`.
- Reuse: `IconButton`, `rulers` glyph, `grid-eye`, `isTypingTarget`.
- Tests: unit math (step 1.2 / 2.4, spine wrap, culling), store, toggle, key; `Rulers` cursor tick show / clear. e2e `rulers.spec.ts`: toggle (by name) and `Shift+R`, scroll keeps rulers present with no page scroll. Skill `ui-review` before push.
