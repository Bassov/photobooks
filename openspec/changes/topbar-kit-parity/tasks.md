## Implementation

- [x] 1. Camera command registry in `cameraStore`; `Pasteboard` registers hook actions (`cameraStore`, `EditorTopBar.test`)
- [x] 2. `MenuKeyboard` in `src/ui/Menu` (`EditorTopBar.test` key hints)
- [x] 3. Zoom − / menu / + with all entries and Fit/N% label (`editorChromePanels.test`, `EditorTopBar.test`)
- [x] 4. Remove placeholders; Preview pill on `onPresent`; kit tooltips (`EditorTopBar.test`, `smoke.spec`)
- [x] 5. Top bar layout `h-12` no-wrap kit order; CSS cleanup
- [x] 6. Delete CameraBar and move its tests (`cameraView.test`, `cameraGesture.test`, e2e helpers)
- [x] 7. e2e `topbar-kit-parity.spec.ts`, 10x repeat green

## Manual test scenarios

1. Open zoom menu, pick 200% → label "200%"; Fit spread → "Fit".
2. Preview pill opens presentation; Esc returns.
3. Undo/Redo tooltips read "Undo (Ctrl+Z)" / "Redo (Shift+Ctrl+Z)" when available.
