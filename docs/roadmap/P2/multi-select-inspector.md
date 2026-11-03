# multi-select-inspector

Tag: feature
Milestone: P2
Title: multi-selection inspector: align, distribute, arrange, delete
Status: done

## Scope

- [x] Multi inspector for 2 or more selected frames (Designer Spec `shared/design/multi-select/spec.md` "Inspector, multi context" and prod Item 2): header "Multiple selection" + meta rule, Align & distribute (core `alignFrames` / `distributeFrames`, unlocked only, disabled reasons, caption), Arrange on the set (new op `reorderFrames`), "Delete N frames"; the #401 context menu and arrange / lock shortcuts act on the set
- **Prod:** `src/editor/inspectorModel.ts` + `Inspector.tsx` (`multi` view), `FrameSections.tsx` (AlignSection, Arrange set, DeleteFrameButton count), `src/core/ops/arrange.ts` + `applyBookOp.ts` (`reorderFrames`), `src/ui/icons/glyphs.ts` (lucide align / distribute / layers glyphs), `FrameContextMenu.tsx`, `frameArrange.ts`
- **Kit:** `uikit/src/sandbox/inspector.tsx` (AlignSection labels, testids, 3-group layout, unlocked-only semantics, caption; ArrangeSection set label), `uikit/src/sandbox/context-inspector.tsx` (multi meta rule)
- **Perf:** an align / distribute click is one book commit; no long task.
- **Browser check:** select three frames and distribute them evenly.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`)
- **Musts:** align and distribute
- **Hard nos:** no fake, dead or disabled-stub controls (a disabled Align / Distribute stays focusable with its reason); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** buttons 28×28, radius 8, bg `#D7D7D7`, hover / pressed `#CACACA`, focus ring 2px `#3A3839`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens
- **Test:** `src/editor/Inspector.test.tsx` + inspectorModel tests (multi), `src/ui/Icon.test.tsx` (glyphs), PBT for `reorderFrames` (relative order kept, set contiguous after front / back); e2e `e2e/multi-select.spec.ts`: three frames distribute to equal gaps (±0.01 mm)
- **Depends:** multi-select-marquee
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`)
