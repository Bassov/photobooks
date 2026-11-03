## Implementation

- [x] 1. Selection set API in `frameSelection.ts` (single-only `getFrameSource`, toggle, per-spread key) + unit tests (`frameSelection.test.ts`, `spreadPreviewKeys.test.ts`)
- [x] 2. `resolveFrameActivation` shift toggle; `activateFrame` toggles / collapses + unit tests (`dropTargets.test.ts`, `galleryDrop.activate.test.ts`)
- [x] 3. Delete / Backspace with 2+ selected: one `removeFrames`, "Delete N frames" label + unit tests (`editorKeys.test.tsx`, `bookHistory.test.ts`)
- [x] 4. `ConnectedSpreadView` pressed per set, no drag on selected frames while 2+; `SpreadView` handles single only, group box + unit tests (`ConnectedSpreadView.test.tsx`, `SpreadView.group.test.tsx`)
- [x] 5. Kit: `canvas.tsx` drop the "N frames" tag; `pages.tsx` "Three frames, one locked" + text (`pnpm uikit:typecheck`)
- [x] 6. `e2e/multi-select.spec.ts` on `?fixture=painter` (4 passed incl. the frame-budget gate)

## Manual test scenarios

1. Shift+click two filled frames on a spread: both outlined, no handles, dashed group box; photos not swapped.
2. Shift+click one of them again: single selection with handles; Esc clears it.
3. Select three frames (one locked), press Delete: all three gone; Undo restores them in one step.
