## Decisions

1. Pure ops `addFrame` / `removeFrames` / `setFrameRect` (`core/ops/frames.ts`) clear `templateId`; `addFrame` refuses an edge < 5 mm.
2. `frameGesture.ts` (document capture, like `cropGesture`): Frame tool draws on bare paper; Select drags an empty frame. DOM-only preview, one op on pointerup (one undo step), Escape cancels.
3. Snapping through a sorted anchor index (`snapIndex.ts`) built at gesture start: frame edges / centers, book + spread guides, equal gaps. 8 px pull; Alt suppresses.
4. Selection reuses Phase A chrome. Empty frames become selectable (`dropTargets`, `galleryDrop`, `frameSelection`; an empty selection is never a swap source, Filmstrip Unplace stays disabled for it). Delete removes the selected empty frame; a focused filled frame still unplaces.
5. Perf label `frame-gesture`; gate in `e2e/free-frames.spec.ts`.

## Touch-set & Test Plan

- Files: `core/ops/frames.ts`, `applyBookOp.ts`, `core/index.ts`; `editor/snapIndex.ts`, `frameGesture.ts`, `frameSelection.ts`, `dropTargets.ts`, `galleryDrop.ts`, `ConnectedSpreadView.tsx`, `Filmstrip.tsx`, `EditorShell.tsx`; tokens: `editorChromeTokens.ts` (`.frame-draft`, `.snap-line` in grey ink `#535152`, `--field` pill) documented in `docs/design.md`.
- Reuse: kit `cursor-tool-frame`, `.spread-frame-placeholder`, Phase A selection chrome.
- Tests: unit per module; e2e `free-frames.spec.ts` (draw, < 5 mm, Delete + undo, filmstrip drop, snap + Alt, move, perf); `ui-review` on that UI.
