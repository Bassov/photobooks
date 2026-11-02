## Decisions

1. Pure `src/editor/frameArrange.ts` builds the ops, the shortcut map (by `event.code`) and the menu items a frame can use (no-op moves hidden). Inspector, menu and keys dispatch through it, so they send the same op.
2. `FrameContextMenu.tsx`: one document `contextmenu` listener on `button.spread-frame` (preview and parent layers excluded) selects the frame and opens kit `Menu` in a `MenuPopover` anchored at the pointer; the keyboard path (Shift+F10 / ContextMenu key, `clientX/Y` 0) anchors at the frame corner.
3. `installArrangeKeys()` in `EditorFrame` beside the rotate keys acts on `getFrameSource()`, calls `preventDefault` only when it acts (also stops Cmd+[ history), skips typing targets. Panel toggles already ignore Ctrl/Cmd.
4. Move / resize already refuse a locked frame. New: a locked filled frame is not draggable (`ConnectedSpreadView`); `galleryDrop.ts` drops a locked `hitTestDrop` result before hover / place / swap. `data-locked` CSS already suppresses the empty-frame hover.

## Touch-set & Test Plan

- Files: `src/editor/frameArrange.ts`, `src/editor/FrameContextMenu.tsx` (new), `src/editor/FrameSections.tsx`, `src/editor/EditorFrame.tsx`, `src/editor/ConnectedSpreadView.tsx`, `src/editor/galleryDrop.ts`, tests, `e2e/arrange-lock.spec.ts`.
- Reuse: `src/ui/Menu`, `dispatchBookOp`, `setFrameSource`, `isTypingTarget`.
- Unit/PBT: shortcut map, menu items, same-op dispatch, lock guards, render-count (z-order leaves the sibling spread unrendered).
- e2e: spec scenarios plus a `frame-budget gates` LoAF scenario (shortcut restack + lock on a multi-spread book).
