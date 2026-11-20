## Implementation

- [x] 1. `uikit/src/sandbox/clipboard.ts`: payload, `pastedRects` (D3 / D4 / D8), `pasteFrames` (D5 / D6), `duplicateFrames` + step memory, `duplicateSpread`, `resetClipboard()`.
- [x] 2. `uikit/src/sandbox/viewport.tsx` `useEditorKeys`: Ctrl+C / X / V / Shift+V / D + document copy / cut / paste listeners; statuses.
- [x] 3. `uikit/src/demo-parts/editor.tsx`: `resetClipboard()` on `DemoEditor` mount.
- [x] 4. `uikit/scripts/demo-capture.mjs`: 5 new steps; undo them before `editor-photo-layer-hover`; re-baseline locally (later shots unchanged vs main).
- [x] 5. `e2e/kit-frame-copy-paste.spec.ts` (6 tests, green locally).

## Manual test scenarios

1. `#/demo` → new book → pages 8–9: select a small frame, Ctrl+C ("Copied frame"), Ctrl+V (+5/+5 mm), Ctrl+V again (+10/+10), Ctrl+Z twice.
2. Click pages 6–7 paper, Esc, Ctrl+V: the frame lands at the same place. Ctrl+Shift+V on 8–9: exactly on the source.
3. Ctrl+D, Shift+→ ×4, Ctrl+D: the second copy repeats the move. Lock a frame, Ctrl+X: lock status, nothing removed.
