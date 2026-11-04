## Implementation

- [ ] 1. `GuideLine` `passive` prop + `--parent-soft` dash + 24 px overhang; `SpreadSurface` passes `passive`
- [ ] 2. `viewport.tsx`: drop the inherited-guide status branch
- [ ] 3. `qa.mjs` parent-guides DOM checks (colour, 1 px, 24 px overhang, pointer-events, elementFromPoint = frame, click selects frame, no status, DOM order)
- [ ] 4. `demo-capture.mjs` step `editor-parent-guides-inherited`; regenerate baselines

## Manual test scenarios

1. Kit `#/demo` editor: Masters → drag a guide from the ruler onto Master A → Pages → spread 2–3 shows the master guides dashed grey, 24 px past the page; click where a master guide crosses a frame → the frame is selected, no status text.
