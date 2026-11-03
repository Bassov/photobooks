## Decisions

1. One store `{ spreadId, frameIds }`; `getFrameSource()` stays single-only (null with 2+), so its callers (crop, rotate, nudge, arrange keys, drop, Inspector) need no change.
2. Per-spread key = selected ids joined by `\n` (another spread: `''` for one, `\n` for 2+, so labels stay right): a spread re-renders only when its own set changes.
3. `resolveFrameActivation` `shift` → `toggle`; a plain click with 2+ resolves to `select-source` (collapse). Shift comes from the click event (Chromium sets it on Enter / Space).
4. `SpreadView` draws handles for exactly one pressed unlocked frame and the group box for 2+ (layout px = screen px).
5. Esc reuses `installEditorKeys`' `setFrameSource(null)`; Delete with 2+ is one `removeFrames`, label in `opLabel`.
6. A selected frame removed by a book change clears the selection.

## Touch-set & Test Plan

| Path                                 | Why                        |
| ------------------------------------ | -------------------------- |
| `src/editor/frameSelection.ts`       | set                        |
| `src/editor/dropTargets.ts`          | toggle                     |
| `src/editor/galleryDrop.ts`          | activate, Delete           |
| `src/editor/ConnectedSpreadView.tsx` | pressed, drag              |
| `src/editor/spreadPreviewKeys.ts`    | set-aware `isFramePressed` |
| `src/editor/bookHistory.ts`          | label                      |
| `src/render/SpreadView.tsx`          | handles, box               |
| `src/render/SpreadView.css`          | box                        |
| `uikit/src/sandbox/canvas.tsx`       | count tag                  |
| `uikit/src/features/pages.tsx`       | scenario                   |
| `e2e/multi-select.spec.ts`           | new                        |

- Kit: `demo-parts/editor.tsx` and demo step 16 need no change (Spec "Kit changes").
- Reuse: core `removeFrames`; tokens `--color-mark`, `--select` per `docs/design.md`.
- Unit: `frameSelection`, `dropTargets`, `galleryDrop`, `SpreadView`, `bookHistory` tests.
- e2e: empty (Esc), happy (Shift+click 2), toggle back to 1, Delete 3 + undo; drag-swap frame-budget gate stays green; skill `ui-review`.
