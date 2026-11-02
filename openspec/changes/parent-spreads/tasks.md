## Implementation

- [x] 1. Core: `setSpreadParent` op replaces `setSpreadMaster` / `masterId` (schema, index, applyBookOp) + unit/PBT — `src/core/ops/spreadLook.test.ts`
- [x] 2. Core: `resolveSpread` emits parent-layer items (`parent: true`) beneath spread frames, memo keyed on the parent + unit/PBT — `src/core/geometry/parentLayer.test.ts`
- [x] 3. Render: `SpreadView` inert parent layer below spread frames + RTL — `src/render/SpreadView.parent.test.tsx`
- [x] 4. Editor: drop targets skip parent items; paint key covers the parent — `src/editor/galleryDrop.parent.test.ts`, `src/editor/bookStore.test.ts`
- [x] 5. Inspector: Master switch lists the book's parents + None (hidden without parents); grid line and Default master show the real parent + RTL — `SpreadSections.test.tsx`, `GridSection.test.tsx`, `BookSettingsKit.test.tsx`
- [x] 6. Painter fixture parents + e2e `parent-spreads.spec.ts` (apply to 2 spreads, click selects nothing, None on one) — `e2e/parent-spreads.spec.ts`

## Manual test scenarios

1. `?fixture=painter`: select spread 2–3, Master → "Master A": a small logo shows in the top margin; same on spread 4–5; the spread list thumbs show it too.
2. Click the logo on the canvas: no frame gets selection handles; the inspector stays on the spread.
3. Spread 2–3 → "None": the logo disappears there, stays on 4–5; no layout shift in the inspector.
