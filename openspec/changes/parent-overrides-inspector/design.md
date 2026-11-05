## Decisions

1. `FrameContextMenu`: own frame button (incl. a copy) → frame menu; else, in a book `spread-view`, `parentHitAt` → `ParentMenu` (frame or guide). The Masters canvas has no parent layer, so it never hits.
2. Pure `overrideCopyOf` in new `src/editor/parentChanges.ts` serves the copy menu and the inspector head.
3. PO6 in `Inspector.tsx`; ↺ dispatches `resetParentItem`, then `setFrameSource(null)` clears the selection. Class `inspector-reset-parent` in `EditorShell.css` (own class: runtime chrome CSS beats `.e7-ghost` overrides).
4. PO7: pure `parentChanges(book, spread)` → ordered named rows; hidden guides placed with exported core `onSpreadPage`. The block renders only when rows exist; row ↺ reuses `e7-ghost insp-grid-reset`.

## Touch-set & Test Plan

| File                                   | Why                                            |
| -------------------------------------- | ---------------------------------------------- |
| `src/editor/FrameContextMenu.tsx`      | PO4 menus                                      |
| `src/editor/FrameContextMenu.test.tsx` | copy rows, parent item / guide menus           |
| `src/editor/parentChanges.ts`          | copy lookup + changes list                     |
| `src/editor/parentChanges.test.ts`     | names, order, dropped ids                      |
| `src/editor/Inspector.tsx`             | PO6 head                                       |
| `src/editor/Inspector.test.tsx`        | head meta + ↺, none without copy               |
| `src/editor/SpreadSections.tsx`        | PO7 block                                      |
| `src/editor/SpreadSections.css`        | PO7 block, rows, Reset all                     |
| `src/editor/SpreadSections.test.tsx`   | block absent / rows / Reset all                |
| `src/editor/EditorShell.css`           | PO6 head ↺                                     |
| `src/core/parentSpreads.ts`            | export `onSpreadPage`                          |
| `src/core/index.ts`                    | re-export `onSpreadPage`, `resolveTextContent` |
| `src/editor/inspectorModel.ts`         | a text copy opens the Text inspector           |
| `src/ui/icons/glyphs.ts`               | `eyeOff`                                       |
| `src/ui/Icon.test.tsx`                 | glyph count 86                                 |
| `e2e/parent-overrides.spec.ts`         | menu override / hide, row ↺, Reset all         |
| `openspec/specs/pasteboard/spec.md`    | PO4                                            |
| `openspec/specs/spread-view/spec.md`   | PO6, PO7                                       |
