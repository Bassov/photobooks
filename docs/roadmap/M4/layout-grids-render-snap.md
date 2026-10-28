# layout-grids-render-snap

Tag: feature
Milestone: M4
Title: see the grid, snap to it

## Scope

- [ ] Grid overlay on the editor overlay layer: margins, columns and rows per page; show / hide grid (view state, shortcut)
- [ ] Pure grid snap (anchors, 16 px pull, Alt / hidden / off rules), `snap · column N` label and snap on / off view state (Shift+S); gesture wiring moved to `layout-grids-snap-wire` (no move / resize gesture exists yet)
- **Perf:** overlay is one SVG per spread (C+R rects per page, no per-cell elements); anchor index is built at gesture start. The drag gate (12-column spread, zero LoAF, `pointermove` p95 ≤ 2 ms) moved to `layout-grids-snap-wire`.
- **Browser check:** toggle the grid while scrolling and zooming — it stays aligned with template frames. Drag / resize snapping checks moved to `layout-grids-snap-wire`.
- **UI ref:** `uikit#/feature/layout-grids-render-snap`
- **UI kit:** `uikit/src/features/m4.tsx:55-58` (`layout-grids-render-snap` demo + notes), `UI ref: uikit#/feature/layout-grids-render-snap` — grid overlay + snap labels
