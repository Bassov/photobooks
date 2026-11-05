## Decisions

1. Copies stay in `Spread.frames` / `Spread.guides` with `overrides`; `SpreadSurface` renders copies right after parent frames, so every existing frame op works on them unchanged.
2. One pure helper module `parent-overrides.ts` (hit test, badge fit, change rows, reset ops); JSX only calls it.
3. The Ctrl/⌘+Shift press is a capture-phase spread handler that stops the event on a hit, so frame Shift-toggle and marquee never see it.
4. `removeFrames` adds a removed copy's parent id to `hiddenParent`: Del and the inspector button both hide.
5. No new tokens (`--parent`, `--parent-soft`, `--radius-xs` from `docs/design.md`). `ui-review` on `#/demo` spread 2–3.

## Touch-set & Test Plan

| Path                                      | Reason                |
| ----------------------------------------- | --------------------- |
| `uikit/src/sandbox/parent-overrides.ts`   | helpers               |
| `uikit/src/sandbox/canvas.tsx`            | frames, press, badge  |
| `uikit/src/sandbox/model.ts`              | `allGuides`           |
| `uikit/src/sandbox/viewport.tsx`          | guide override / hide |
| `uikit/src/sandbox/store.tsx`             | delete hides          |
| `uikit/src/sandbox/inspector.tsx`         | Arrange, labels       |
| `uikit/src/sandbox/context-inspector.tsx` | PO6 / PO7             |
| `uikit/src/demo-parts/editor.tsx`         | feature note          |
| `uikit/scripts/demo-capture.mjs`          | demo steps            |
| `uikit/scripts/qa.mjs`                    | Control+Shift         |
| `e2e/kit-parent-overrides.spec.ts`        | e2e                   |

- Reuse: `onFrameDown` move gesture, `guideDrag`, `removeFrames`, `mapSpread`.
- Tests: roadmap Test line; plus Alt makes no copy, no `parent-changes` block when nothing changed. e2e empty / happy / interact as in the proposal.
