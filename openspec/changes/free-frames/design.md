## Decisions

1. Document ops `addFrame` / `removeFrames` / `setFrameRect` in `src/core/ops/frames.ts` (pure, structural sharing); each clears `templateId`. `addFrame` refuses an edge < 5 mm, so the 5 mm rule lives in core. `frame-transform-ops` is not on main; these are the minimal subset this slice needs.
2. One gesture module `frameGesture.ts` (document capture, like `cropGesture`): Frame tool draws on bare paper; Select tool drags an empty frame. Preview is direct DOM writes (draft box, `left/top`, snap lines); one op commits on pointerup (one undo step). Escape cancels.
3. Snapping via a sorted anchor index (`snapIndex.ts`) built at gesture start from other frames (edges, centers), book + spread guides (model already on main; no UI) and equal gaps; per-move cost is binary search. Pull 8 client px; Alt suppresses. Lines use the grey ink token and the `.snap-label` look; no blue.
4. Selection reuses Phase A (`frameSelection`, `aria-pressed` chrome + handles). Empty frames become selectable; the store drops the selection when the frame vanishes or gains / loses its photo. An empty selected frame is never a swap source.
5. Delete / Backspace: filled focused frame still unplaces (Phase A contract); otherwise the selected empty frame is removed.
6. Filled frames keep HTML drag (swap), so only empty frames pointer-move.
7. Perf: handler label `frame-gesture` (`measureHandlerSync`), gate in `e2e/free-frames.spec.ts` (`frame-budget gates`).

## Touch-set & Test Plan

- Files: `src/core/ops/frames.ts`, `applyBookOp.ts`, `core/index.ts`; `src/editor/snapIndex.ts`, `frameGesture.ts`, `frameSelection.ts`, `dropTargets.ts`, `galleryDrop.ts`, `ConnectedSpreadView.tsx`, `Filmstrip.tsx`, `EditorShell.tsx`, `editorChromeTokens.ts`.
- Reuse: `cropGesture` pattern, `measureHandlerSync`, kit `cursor-tool-frame`, `.spread-frame-placeholder`, selection chrome, `dropTargets` drop index.
- Tests: unit `frames.test.ts`, `snapIndex.test.ts`, `frameGesture.test.ts`, `editorKeys`, `frameSelection`, `dropTargets`; e2e `free-frames.spec.ts` (draw, < 5 mm, Delete + undo, filmstrip drop, snap line + Alt, perf gate).
