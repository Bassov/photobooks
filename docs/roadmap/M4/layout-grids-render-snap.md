# layout-grids-render-snap

Tag: feature
Milestone: M4
Title: see the grid, snap to it

## Scope

- [ ] Grid overlay on the editor overlay layer: margins, columns and rows per page; show / hide grid (view state, shortcut)
- [ ] Frame move / resize from `frame-selection-handles` snaps to margin, column and row edges via `snapping-engine` with active snap lines; snap to grid on / off (view state)
- **Perf:** overlay is one SVG pattern per page, not per-cell elements; anchor index built at gesture start. Gate: drag a frame across a 12-column spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** toggle the grid while scrolling and zooming — it stays aligned with template frames; drag and resize a frame — it snaps to columns and margins with visible snap lines; with snap off it moves freely.
- **UI ref:** `uikit#/feature/layout-grids-render-snap`
- **UI kit:** `uikit/src/features/m4.tsx:55-58` (`layout-grids-render-snap` demo + notes), `UI ref: uikit#/feature/layout-grids-render-snap` — grid overlay + snap labels
