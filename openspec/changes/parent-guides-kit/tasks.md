## Implementation

- [x] 1. `GuideLine` `passive` prop + `--parent-soft` dash + 24 px overhang; `SpreadSurface` passes `passive`
- [x] 2. `viewport.tsx`: drop the inherited-guide status branch
- [x] 3. `qa.mjs` parent-guides DOM checks (colour, 1 px, 24 px overhang, pointer-events, elementFromPoint = frame, click selects frame, no status, DOM order); empty observable (Master None → no master guide) stays pinned by the existing v7.3 P1 check
- [x] 4. `demo-capture.mjs` step `editor-parent-guides-inherited`; regenerate baselines (untracked, `.cache/agent`)

## Manual test scenarios

1. Kit `#/demo` editor: Masters → drag a guide from the ruler onto Master A → Pages → spread 2–3 shows the master guides dashed grey, 24 px past the page; click where a master guide crosses a frame → the frame is selected, no status text.
   - OK (kit qa:quick 353/0 + demo walk step 33): agent `manual-qa` drives prod only, so the kit walk is the qa.mjs block — 5 inherited guides, `rgb(163, 161, 162)` dash, 1 px, overhang 24/24 px, `pointer-events: none`; `elementFromPoint` on a guide over frame `f10480kuk` = that frame, the click selects it, no parent-spread status. Demo step `33-editor-parent-guides-inherited` shows the walk's current Master A child (pages 8–9) with the dashed guides incl. the one just added at 114 mm.
