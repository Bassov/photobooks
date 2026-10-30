## Decisions

1. Guides stay in the document (`spread.guides`, offset in mm): they are undoable steps and the existing snap index already reads them. Three core ops (`addGuide` / `moveGuide` / `removeGuide`, 0.1 mm rounding, locked guides immutable) are the only model change.
2. "Show guides" is editor-only view state (`guidesView`, default on), like rulers and grid; never in the document, Preview or exports. Snap on / off reuses the shipped Snap toggle.
3. The editor overlay layer is `GuidesOverlay` in `SpreadView`'s `overlay` slot (beside `GridOverlay`); `ConnectedSpreadView` takes `editorLayer` (off in Preview).
4. Gesture is imperative (`guideGesture`): pointermove only stores the event, a rAF applies a `transform` to the line and updates the mm tag; the book changes once on pointerup. Dropping on the originating ruler or beyond 20 mm off the spread removes a placed guide and abandons a new one (kit `guideDrag`).
5. Rulers become the guide source (top strip → horizontal, left strip → vertical); pulling while hidden shows guides again.
6. Colours: `--guide` / `--field` / `--foreground` tokens (grayscale); no blue, no teal.

## Touch-set & Test Plan

- `src/core/ops/guides.ts` (+ `applyBookOp`, `core/index`), `bookHistory` labels: unit + PBT.
- `src/editor/`: `guidesView`, `guidesMath` (PBT), `guideGesture`, `GuidesOverlay`, `GuidesToggle`, `Guides.css`, `Rulers` / `Rulers.css`, `ConnectedSpreadView`, `PresentationMode`, `EditorTopBar`, `installEditorGridKeys`: unit tests each.
- `e2e/guides.spec.ts`: pull from both rulers, abandon, move + delete + undo, zoom alignment, hide / Ctrl+;, Presentation, frame-budget (`package.json` `perf` script lists it).
