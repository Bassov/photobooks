# layout-grids-render-snap

Tag: feature
Milestone: M4
Title: see the grid, snap to it
Status: done

## Scope

- [ ] Grid overlay on the editor overlay layer: margins, columns and rows per page; show / hide grid (view state, shortcut)
- [ ] Pure grid snap (anchors, 16 px pull, Alt / hidden / off rules), `snap · column N` label and snap on / off view state (Shift+S); gesture wiring moved to `layout-grids-snap-wire` (no move / resize gesture exists yet)
- **Perf:** overlay is one SVG per spread (C+R rects per page, no per-cell elements); anchor index is built at gesture start. The drag gate (12-column spread, zero LoAF, `pointermove` p95 ≤ 2 ms) moved to `layout-grids-snap-wire`.
- **Browser check:** toggle the grid while scrolling and zooming — it stays aligned with template frames. Drag / resize snapping checks moved to `layout-grids-snap-wire`.
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
