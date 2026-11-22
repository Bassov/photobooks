## Implementation

- [ ] 1. `layoutCatalog.ts`: `pickerLayouts`, `cycleSet`, `stepLayout`; `LayoutSection.tsx` uses `pickerLayouts`.
- [ ] 2. `layoutCycle.ts`: cycle state of a spread and `cycleLayout(spreadId, dir)` via the picker op (key
      `cycleLayout:<spreadId>`, label "Change layout"); PBT `layoutCycle.test.ts`.
- [ ] 3. `LayoutCycle.tsx` + `.css`, rendered in the active slot (`Pasteboard.tsx`), `LAYOUT_CYCLE_MIN_GAP_PX` /
      `layoutCycleFits`, live-zoom `data-gap-min`, slot clip margin; `LayoutCycle.test.tsx`.
- [ ] 4. Pointer: pill stops `pointerdown`; `marquee.ts` ignores the pill.
- [ ] 5. `installLayoutCycleKeys.ts` installed in `EditorFrame.tsx`; Shift brackets never toggle panels; unit test.
- [ ] 6. `e2e/cycle-layouts.spec.ts` (Done-when numbers).

## Manual test scenarios

1. 1440×900, Fit, spread 2–3 active: pill above the paper, centred; › and ⇧] change the layout, ‹ and ⇧[ go back.
2. Three ⇧] then Ctrl+Z: the first layout is back in one step; `]` toggles the inspector.
3. Zoom out with the wheel until the gap is small: the pill disappears; drag a photo from the filmstrip: the pill hides.
