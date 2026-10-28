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
- **Kit components:** `GridOverlay` in `uikit/src/sandbox/canvas.tsx` (live editor); the static `GridOverlay` in `uikit/src/spread.tsx` is kit-demo only — prefer canvas; `effectiveGrid` / `resolveGrid` / `anchors` / `snapRect` (`uikit/src/sandbox/model.ts`); TopBar view toggle `grid` (`uikit/src/sandbox/chrome.tsx`)
- **Demo:** `layout-grids-render-snap` → `uikit/src/features/m4.tsx`
- **Musts:**
  - `view.grid` on && !Preview: per-page dashed content box (1.5px) + column bands + row bands from `effectiveGrid`; facing pages mirror inside / outside.
  - Overlay `pointer-events: none`; never in Preview / PDF / site.
  - TopBar "Layout grid" / Ctrl+'; quiet gray pressed.
  - Snap (existing frames move / resize only): grid visible + snap on → edges to column / row; label `snap · column N` / `snap · row N` (bg-field pill, not toast); ~16 CSS px pull when grid visible.
  - Hidden grid → no grid snap. Alt-drag → no snap. Snap off → no lines.
- **Hard nos:** no teal / cyan (`#2f9e9a`); no guides / rulers / Frame create; no multi-select; no black on overlay strokes; no floating FrameToolbar.
- **Tokens:** `--grid-line: rgb(83 81 82 / .6)`; `--grid` fill `rgb(83 81 82 / .10)`.
- **Test:** show grid → cols / rows match inspector C×R; hide → overlay gone + no column snap; Alt-drag → no snap label.
- **Depends:** layout-grids-settings
