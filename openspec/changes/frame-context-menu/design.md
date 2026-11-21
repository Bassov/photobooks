## Decisions

1. `frameMenuRows(book, target, ctx)` is pure: groups photo · edit · order · lock+delete joined by `'separator'`; rows carry raw key strings, `menuKeys(keys, mac)` formats them at render.
2. Edit scope = `frameEditScope(spreadId)` exported from `frameClipboard.ts` (Pages tab, interior spread, no text edit); the photo group needs it too (none on Masters), as the kit.
3. Dispatch reuses existing commands (frameClipboard, `startPhotoPick`, inspector `unplace` / `setFit`, `enterCropMode`, arrange actions, `deleteFramesOp`). Menu Copy / Cut also put the payload on the system clipboard via a one-shot `copy` capture listener, as kit `writeClipboard`: same payload the Ctrl+C path writes, own MIME type, no reads.
4. M5: `autoFocus = keyboard ? 'first' : true` (keyboard = clientX/Y 0); `disabledKeys` from the model.
5. Page menu: own frame and parent hits miss, paper in edit scope, mirror set → no selection, spread active, `page-menu` (`w-max min-w-56`).
6. Tokens: `pb-menu-item` (`--accent` hover, destructive variant, docs/design.md Menu); no new CSS.

## Touch-set & Test Plan

| File                                   | Why          |
| -------------------------------------- | ------------ |
| `src/editor/frameMenuModel.ts`         | new          |
| `src/editor/frameMenuModel.test.ts`    | new          |
| `src/editor/menuKeys.ts`               | new          |
| `src/editor/menuKeys.test.ts`          | new          |
| `src/editor/FrameContextMenu.tsx`      | menu         |
| `src/editor/FrameContextMenu.test.tsx` | pins         |
| `src/editor/frameClipboard.ts`         | scope export |
| `src/ui/icons/glyphs.ts`               | glyphs       |
| `e2e/frame-context-menu.spec.ts`       | new          |
| `e2e/arrange-lock.spec.ts`             | pins         |
| `e2e/parent-overrides.spec.ts`         | pins         |
| `openspec/specs/pasteboard/spec.md`    | delta        |

e2e: empty (text / locked kinds), happy (filled 14 rows), interact (page-menu Paste, pick); skill `ui-review` before push.
