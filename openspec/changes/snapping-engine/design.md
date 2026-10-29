## Decisions

1. Reuse `src/editor/snapIndex.ts` (free-frames); add page anchors via an optional `SnapPage` arg to `buildSnapIndex`, built once in `spreadContext`.
2. Kind `frame edge` → `frame` so labels read `snap · frame`.
3. Resize snaps only the dragged edges (`snapEdges`); skipped for rotated frames, Shift-ratio and Alt (Alt = from-centre = no snap).
4. `snapBypassed(event)` = Alt or snap toggle off, shared by draw / move / resize.
5. Stroke `#393738` (T token); new `magnet` icon + `SnapToggle` beside `GridToggle`.

## Touch-set & Test Plan

- Files: `snapIndex.ts`, `frameGesture.ts`, `frameHandleGesture.ts`, `gridView.ts`, `SnapToggle.tsx`, `EditorTopBar.tsx`, `editorChromeTokens.ts`, `ui/icons/glyphs.ts`. No gate-config edits.
- Reuse: `paintSnapLines`, `gridView` snap flag, `installEditorGridKeys` Shift+S.
- Tests: unit (`snapIndex`, `frameGesture`, `frameHandleGesture`, `SnapToggle`), `snapIndex.bench.ts`, e2e in `free-frames.spec.ts`.
