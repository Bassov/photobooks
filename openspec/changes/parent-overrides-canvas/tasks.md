## Implementation

- [x] 1. Core: `ResolvedItem.override` on copies; `removeFrames` removes copies and hides their parent ids (unit tests).
- [x] 2. SpreadView: copies as controlled buttons in the parent layer with `data-override`; dashed screen-px outline on inherited editor items; override badge with the fit rule (`overrideBadge.ts`); `SpreadView.parent.test.tsx` cases.
- [x] 3. `src/editor/parentHit.ts`: guide band then topmost rotation-aware parent frame (unit + PBT).
- [x] 4. `frameGesture.ts`: Ctrl/⌘+Shift press → override + select + move continuation, click swallowed, Alt untouched; plain press status (`editorStatus.ts`); unit tests.
- [x] 5. Copies reach frame tools: lookups in `frameGesture` / `frameHandleGesture` / `frameSelection` / `cropMode`; `frameArrange` lock on copies, no z-order, `deleteFramesOp`; `galleryDrop` Delete + drop targets (unit tests).
- [x] 6. `e2e/parent-overrides.spec.ts`: Ctrl+Shift through an own frame copies and moves the logo, undo twice, badge full / icon / none by DOM size, document fits viewport.

## Manual test scenarios

1. Painter fixture with Master A: every spread's logo shows a dashed outline; plain click on it selects nothing and announces the Ctrl+Shift hint.
2. Draw a frame over the logo, Ctrl+Shift-drag on the logo: the copy (badge "override") moves, the drawn frame stays; Undo twice restores the parent logo.

Harness problem (2026-11-05): `pnpm agent manual-qa --change parent-overrides-canvas` stopped at the welcome screen for both scenarios (`start-session` click intercepted by the welcome `header`, 30 s timeout); no product behaviour was observed there. Both scenarios are driven with real pointer and keyboard input in `e2e/parent-overrides.spec.ts` (outline computed style, status text, Ctrl+Shift press through an own frame, 30 px move, two undos, badge full / icon / none), green locally with `e2e/parent-spreads.spec.ts` unchanged.
