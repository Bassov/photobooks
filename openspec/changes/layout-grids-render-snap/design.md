## Decisions

1. Tokens `--grid-line: rgb(83 81 82/.6)`, `--grid-fill: rgb(83 81 82/.10)` live in `EDITOR_CHROME_CSS` under `.e7`; the SVG uses them via `style` (CSS vars don't work in presentation attributes). Grayscale only.
2. Snap view state (`snapOn`, default true) sits next to `gridVisible` in `gridView.ts`; both editor-only, never in the document.
3. `gridSnap.ts` is pure: anchors built once per gesture from `pageGridRects` (column/row edges, 1-based labels; margins are the outer band edges); `snapEdges` pulls the nearest anchor within 16 CSS px and returns `{delta, label}` or null. Disabled when grid hidden, snap off, or Alt held.
4. Label `snap · column N` is a quiet `--field` pill (`SnapLabel`) fed by a tiny `snapHint` store; the future gesture only calls `setSnapHint`.
5. Ctrl+' / Shift+S handled by `installEditorGridKeys` (typing targets ignored).

## Touch-set & Test Plan

- Files: `gridView.ts`, `gridSnap.ts`, `snapHint.ts`, `GridOverlay.tsx`, `SnapLabel.tsx`, `installEditorGridKeys.ts`, `EditorFrame.tsx`, `EditorTopBar.tsx`, `editorChromeTokens.ts`, `docs/design.md`.
- Reuse: `pageGridRects`, `IconButton`.
- Tests: unit for gridSnap (mirrored pages, Alt/hidden/off), gridView, keys, overlay (dashed box, bands = C×R, hidden → none, pointer-events none), TopBar toggle; e2e: show grid → overlay matches inspector C×R, hide → gone.
