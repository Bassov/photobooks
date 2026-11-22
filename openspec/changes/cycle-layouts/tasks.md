## Implementation

- [x] 1. `layoutCatalog.ts`: `pickerLayouts`, `cycleSet`, `stepLayout`; `LayoutSection.tsx` uses `pickerLayouts`.
      (`LayoutSection*.test.tsx` unchanged green; `layoutCycle.test.ts` cycleSet / stepLayout)
- [x] 2. `layoutCycle.ts`: cycle state of a spread and `cycleLayout(spreadId, dir)` via the picker op (key
      `cycleLayout:<spreadId>`, label "Change layout"); PBT `layoutCycle.test.ts`.
- [x] 3. `LayoutCycle.tsx` + `.css`, rendered in the active slot (`Pasteboard.tsx`), `LAYOUT_CYCLE_MIN_GAP_PX` /
      `layoutCycleFits`, live-zoom `data-gap-min`, active slot without paint containment; `LayoutCycle.test.tsx`,
      `e2e/cycle-layouts.spec.ts` geometry + paint hit test.
- [x] 4. Pointer: pill stops `pointerdown`; `marquee.ts` ignores the pill (`LayoutCycle.test.tsx`, e2e no marquee).
- [x] 5. `installLayoutCycleKeys.ts` installed in `EditorFrame.tsx`; Shift brackets never toggle panels
      (`installLayoutCycleKeys.test.ts`, `installEditorChromeKeys.test.ts`).
- [x] 6. `e2e/cycle-layouts.spec.ts` (Done-when numbers; 4 passed).

## Manual test scenarios

1. 1440×900, Fit, spread 2–3 active: pill above the paper, centred; › and ⇧] change the layout, ‹ and ⇧[ go back.
2. Three ⇧] then Ctrl+Z: the first layout is back in one step; `]` toggles the inspector.
3. Zoom out with the wheel until the gap is small: the pill disappears; drag a photo from the filmstrip: the pill hides.

manual-qa (2026-11-22): harness problem: all three blocked at the welcome screen (the header intercepts the
`start-session` click), so none ran. Covered instead by `e2e/cycle-layouts.spec.ts` (4 passed): 1 = geometry + paint +
› width test; 2 = ⇧] / Ctrl+Z / `]` test; 3 = short-gap / Masters / Preview / asset-drag test.
