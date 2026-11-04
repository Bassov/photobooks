## Implementation

- [ ] 1. Core: `ResolvedItem.override` on copies; `removeFrames` removes copies and hides their parent ids (unit tests).
- [ ] 2. SpreadView: copies as controlled buttons in the parent layer with `data-override`; dashed screen-px outline on inherited editor items; override badge with the fit rule (`overrideBadge.ts`); `SpreadView.parent.test.tsx` cases.
- [ ] 3. `src/editor/parentHit.ts`: guide band then topmost rotation-aware parent frame (unit + PBT).
- [ ] 4. `frameGesture.ts`: Ctrl/⌘+Shift press → override + select + move continuation, click swallowed, Alt untouched; plain press status (`editorStatus.ts`); unit tests.
- [ ] 5. Copies reach frame tools: lookups in `frameGesture` / `frameHandleGesture` / `frameSelection` / `cropMode`; `frameArrange` lock on copies, no z-order, `deleteFramesOp`; `galleryDrop` Delete + drop targets (unit tests).
- [ ] 6. `e2e/parent-overrides.spec.ts`: Ctrl+Shift through an own frame copies and moves the logo, undo twice, badge full / icon / none by DOM size, document fits viewport.

## Manual test scenarios

1. Painter fixture with Master A: every spread's logo shows a dashed outline; plain click on it selects nothing and announces the Ctrl+Shift hint.
2. Draw a frame over the logo, Ctrl+Shift-drag on the logo: the copy (badge "override") moves, the drawn frame stays; Undo twice restores the parent logo.
