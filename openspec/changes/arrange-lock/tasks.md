## Implementation

- [x] 1. `frameArrange.ts`: op builders, shortcut mapping, menu item list, lock lookup + unit/PBT (`src/editor/frameArrange.test.ts`)
- [x] 2. Inspector `ArrangeSection` / `FrameLockButton` dispatch through the builders (`FrameSections.tsx`)
- [x] 3. `FrameContextMenu.tsx` on editor frames + `installArrangeKeys` in `EditorFrame` (same-op test `src/editor/FrameContextMenu.test.tsx`)
- [x] 4. Lock guard: locked filled frame not draggable; `galleryDrop` rejects a locked target (`ConnectedSpreadView.test.tsx`, `Pasteboard.drop.test.tsx`)
- [x] 5. Render-count test: z-order re-renders only its spread (`ConnectedSpreadView.test.tsx` "a z-order change re-renders only its spread")
- [x] 6. e2e `e2e/arrange-lock.spec.ts`: send behind + lock; locked frame ignores drag / resize / photo drop; unlock restores; frame-budget LoAF scenario (local 3/3, 0 LoAF)

## Manual test scenarios

1. Draw two overlapping frames, right-click the top one → Send to back: the other frame is on top; Ctrl+Shift+] brings it back.
2. Right-click → Lock: frame shows the lock badge, drag does not move it, no handles, a filmstrip photo dropped on it is refused; Ctrl+Shift+L unlocks and drag moves it again.
3. Shift+F10 on a focused frame opens the same menu; Escape closes it.
