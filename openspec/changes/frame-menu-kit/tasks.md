## Implementation

- [x] 1. `store.tsx`: `zMove` / `zMovesFor` / `Z_LABEL` (from inspector ArrangeSection), `pick` / `setPick`, `startPick`; ArrangeSection uses `zMove`.
- [x] 2. `frame-menu.tsx`: contextmenu targeting (keyboard, selected-first, own frame, page), rows per kind with disabled rules, `menuKeys`, commands.
- [x] 3. `viewport.tsx`: mount `<FrameMenu />` in the camera and the stack; Esc ends `pick` first.
- [x] 4. `e2e/kit-frame-menu.spec.ts`: rows per kind, focus, labels, paste, size, paint, y 840.

## Manual test scenarios

1. `#/demo`: new book, photo folder, drop a photo on spread 4 frame 1, right-click it: 14 rows, no row highlighted; Fit photo to frame → right-click again shows Fill frame.
2. Copy from the menu, right-click the paper corner: Paste / Paste in place; Paste adds a frame.
