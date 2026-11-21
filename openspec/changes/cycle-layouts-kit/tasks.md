## Implementation

- [x] 1. `templates.ts`: `cycleSet`, `stepLayout`, `applyId` (e2e `kit-layout-cycle.spec.ts` "same width across presses",
      "Custom after a hand move").
- [x] 2. `layout-cycle.tsx`: `rebindFrames`, `cycleLayout`, `LayoutCycle` pill, `useLayoutCycleKeys` (e2e geometry, keys,
      props tests).
- [x] 3. `store.tsx`: `cycle:` coalescing with no window, `drafting` flag; `chrome.tsx` `applyTemplate` keeps frame props
      (e2e "3 presses then Ctrl+Z = 1 step", picker parity in the props test; `kit-live-captions` freeze unchanged).
- [x] 4. `viewport.tsx`: pill in the active stack slot with the room rule, keys beside `useEditorKeys`, band centring (e2e
      "hidden at gap < 63", "design-parity p4 … 56/48 band"; `kit-editor-canvas` r17 remount unchanged).
- [x] 5. `demo-capture.mjs`: `editor-layout-cycle-hover` / `-next` / `-undone` after `editor-spread-1` (walk: 105 steps,
      no page errors).
- [x] 6. `e2e/kit-layout-cycle.spec.ts`: geometry, visibility, keys, undo run, props kept (7 tests green).

## Manual test scenarios

1. Kit `#/demo` 1440×900, new book with photos, spread 2–3 at Fit: the pill sits centred 8 px above the paper; hover ›
   shows "Next layout ⇧]"; click › changes the layout and the name; Ctrl+Z restores it.
2. ⇧] three times then Ctrl+Z returns the first layout; `]` alone hides the inspector.
3. Zoom out to the floor: the pill hides; ⇧] still changes the layout.
