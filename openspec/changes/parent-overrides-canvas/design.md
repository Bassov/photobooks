## Decisions

1. `ResolvedItem.override?: true` marks a copy; `parent: true` keeps meaning "parent layer" (inherited and copies).
2. SpreadView: copies get a `FrameControl` and render as buttons with `data-override` inside the parent layer (layer stays inert, the button takes the pointer). Inherited editor items carry the dashed outline as screen-px chrome. Badge fit is a pure function of the committed frame box. Tokens: kit `--parent`, `--parent-soft`, `--radius-xs`, `--text-2xs`, glyph `unlink2` (all exist; `docs/design.md` gains the badge / outline line).
3. `src/editor/parentHit.ts` is pure (book, spread, point mm, px per mm): guide band first, else topmost rotation-aware parent frame.
4. `frameGesture.ts` owns the modifier press (document capture), so it precedes own-frame handling and continues as its existing move session.
5. Editor lookups go through `findSpreadFrame` / `spreadFrames`; z-order stays own frames (`layerOf`). Core ops already find copies (`updateFrame`), so `transform.ts` / `fill.ts` / `index.ts` need no edit.
6. Core `removeFrames` hides a listed copy's parent item; a lone copy's Delete dispatches `hideParentItem` for its label.

## Touch-set & Test Plan

| File                                       | Why                                                       |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/core/geometry/types.ts`               | flag                                                      |
| `src/core/geometry/resolveSpread.ts`       | flag                                                      |
| `src/core/ops/frames.ts`                   | copy delete                                               |
| `src/core/ops/frames.test.ts`              | unit                                                      |
| `src/core/parentOverrides.test.ts`         | copy delete now hides                                     |
| `src/render/SpreadView.tsx`                | copies, outline, badge                                    |
| `src/render/SpreadView.css`                | same                                                      |
| `src/render/overrideBadge.ts`              | fit rule                                                  |
| `src/render/overrideBadge.test.ts`         | unit                                                      |
| `src/render/SpreadView.parent.test.tsx`    | copies, outline                                           |
| `src/editor/parentHit.ts`                  | hit test                                                  |
| `src/editor/parentHit.test.ts`             | unit + PBT                                                |
| `src/editor/frameGesture.ts`               | press, status                                             |
| `src/editor/frameGesture.override.test.ts` | unit                                                      |
| `src/editor/frameHandleGesture.ts`         | lookup                                                    |
| `src/editor/frameSelection.ts`             | lookup                                                    |
| `src/editor/cropMode.ts`                   | lookup                                                    |
| `src/editor/frameArrange.ts`               | lock, delete op                                           |
| `src/editor/frameArrange.test.ts`          | unit                                                      |
| `src/editor/galleryDrop.ts`                | Delete, drop targets                                      |
| `src/editor/galleryDrop.parent.test.ts`    | unit                                                      |
| `src/editor/editorStatus.ts`               | status text                                               |
| `docs/design.md`                           | badge / outline tokens                                    |
| `e2e/parent-overrides.spec.ts`             | gesture, undo, badge fit ×3, `assertDocumentFitsViewport` |

`e2e/parent-spreads.spec.ts` stays unchanged.
