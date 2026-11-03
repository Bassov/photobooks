## Decisions

1. **View.** `inspectorView` takes the frame selection; 2+ frames on a book spread → kind `multi`. Pure `multiSummary`, `alignState` (counts, reasons) and `selectionCaption` (unrotated AABB, `round1` mm) live in `inspectorModel.ts`.
2. **Core.** Reuse `alignFrames` / `distributeFrames`; add `reorderFrames` (semantics: spec delta) and `setFramesLocked` in `arrange.ts`, one undo step each.
3. **Set actions** in `frameArrange.ts` drive shortcuts and the context menu with 2+ selected; single paths unchanged.
4. **UI.** New `MultiSections.tsx` (Align & distribute) keeps `FrameSections.tsx` small; that file gains the set Arrange row and Delete N. `IconButton` gains kit `disabledReason` (`aria-disabled`, focusable, reason tooltip). Tokens `--control-xs`, `--field`, `--sel`, `--shadow-xs`, `--ring`.

## Touch-set & Test Plan

| Path                                      | Why                 |
| ----------------------------------------- | ------------------- |
| `src/core/ops/arrange.ts`                 | ops                 |
| `src/core/ops/applyBookOp.ts`             | ops                 |
| `src/core/index.ts`                       | exports             |
| `src/editor/inspectorModel.ts`            | model               |
| `src/editor/Inspector.tsx`                | header              |
| `src/editor/MultiSections.tsx`            | align               |
| `src/editor/FrameSections.tsx`            | arrange, delete     |
| `src/editor/FrameSections.css`            | buttons             |
| `src/editor/frameArrange.ts`              | set actions         |
| `src/editor/FrameContextMenu.tsx`         | menu                |
| `src/editor/bookHistory.ts`               | labels              |
| `src/ui/IconButton.tsx`                   | disabledReason      |
| `src/ui/IconButton.css`                   | disabledReason look |
| `src/ui/icons/glyphs.ts`                  | glyphs              |
| `docs/design.md`                          | IconButton row      |
| `uikit/src/sandbox/inspector.tsx`         | kit sections        |
| `uikit/src/sandbox/context-inspector.tsx` | meta line           |
| `uikit/src/features/pages.tsx`            | Spec kit edge line  |
| `openspec/specs/pasteboard/spec.md`       | sync                |
| `docs/roadmap.md`                         | umbrella tick       |

- Unit / PBT: arrange (relative order, contiguous), transform, inspectorModel, Inspector, frameArrange, FrameContextMenu, bookHistory, IconButton, Icon.
- e2e `multi-select.spec.ts`: empty (2 frames: Distribute disabled), happy (distribute ±0.01 mm, align with locked, Undo, Delete 3), interact (menu), no page scroll, LoAF. Skill `ui-review` before push.
