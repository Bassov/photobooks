## Implementation

- [x] 1. `photoPick.ts` store + cancel rules + status, unit tests (`src/editor/photoPick.test.ts`).
- [x] 2. Filmstrip `data-picking`, ring / cursor CSS, click / Enter pick, roving focus on start (`src/editor/Filmstrip.photoPick.test.tsx`).
- [x] 3. "Replacing" / "Placing" frame tag (`SpreadView` + `ConnectedSpreadView`; `ConnectedSpreadView.test.tsx`).
- [x] 4. FrameContextMenu "Replace photo…" / "Place photo…" rows + unit; Preview open ends the pick (`FrameContextMenu.test.tsx`, `EditorShell.test.tsx`).
- [x] 5. `e2e/photo-pick.spec.ts` (6 tests, green locally).

## Manual test scenarios

1. Right-click a filled frame → Replace photo… → filmstrip ring + status; click another thumb → frame shows it; Ctrl+Z restores.
2. Place photo… on an empty frame, Esc → no change; pointerdown on a filter keeps the mode.
