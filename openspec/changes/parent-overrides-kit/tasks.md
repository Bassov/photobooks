## Implementation

- [x] 1. `parent-overrides.ts` pure helpers: `parentHit`, `badgeFit`, `parentChanges` + reset ops; `Guide.overrides` and `allGuides` suppression in `model.ts`. (e2e guide tests)
- [x] 2. `canvas.tsx` FrameEl: inherited frames under own frames and pointer-transparent; copy `data-override`, `Unlink2` badge with the fit rule (not in Preview / crop). (e2e "paint under own frames", "badge follows the fit rule")
- [x] 3. `canvas.tsx` SpreadSurface: paint order; Ctrl/⌘+Shift capture press (guide → copy reselect → parent frame copy + move); no Alt; plain press status over an uncovered parent item. (e2e "reselects it with no undo step", "Alt does not")
- [x] 4. Delete hides: `removeFrames` adds `hiddenParent`; labels; Arrange hidden for copies. (e2e "Delete on a copy … hide")
- [x] 5. `viewport.tsx` guide override (copy + drag) and hide (copy guide off / onto ruler). (e2e "Ctrl+Shift-drag on a parent guide")
- [x] 6. `context-inspector.tsx`: `InspectorShell` `action`; PO6 head meta + ↺; PO7 "Changed from" block, per-row ↺, Reset all. (e2e rows / sizes 24 · 28 · 16, ↺ 28×28)
- [x] 7. Demo walk (`editor-parent-item-overridden` Control+Shift, `editor-parent-changes`, `editor-parent-reset-all`) + qa.mjs line; baselines of touched steps. (demo walk 79 steps, kit qa:quick 388/0)
- [x] 8. e2e `e2e/kit-parent-overrides.spec.ts` (Test Plan in design.md). (5 passed)

## Manual test scenarios

1. `uikit#/demo`, spread 2–3: Ctrl+Shift+click the Chapter line over the photo → copy selected, inspector head `Override · Master A`; drag it right; spread inspector lists it; Reset all → back to the master.

- problem (harness): `pnpm agent manual-qa` drives the prod editor shell only, not `uikit#/demo`. Covered instead by `e2e/kit-parent-overrides.spec.ts` (5 passed), the demo walk (79 steps incl. `editor-parent-changes` / `editor-parent-reset-all`) and kit `qa:quick` (388 passed, 0 failed).
