# layout-grids-render-snap

Tag: feature
Milestone: M4
Title: see the grid
Status: done

## Scope

- [x] Grid overlay on the editor overlay layer only (`GridOverlay` + chrome tokens): margins, columns and rows per page; never in Preview, PDF or site
- [x] Show / hide grid (view state): eye toggle in the top bar and Ctrl/⌘+'
- **Perf:** overlay is one SVG per spread (C+R rects per page, no per-cell elements).
- **Browser check:** toggle the grid while scrolling and zooming — it stays aligned with template frames; Preview / PDF / site never show the overlay.
- **UI ref:** `uikit#/feature/layout-grids-render-snap`
- **UI kit:** `uikit/src/features/m4.tsx:55-58` (`layout-grids-render-snap` demo + notes), `UI ref: uikit#/feature/layout-grids-render-snap` — grid overlay
- **Kit components:** `GridOverlay` in `uikit/src/sandbox/canvas.tsx` (live editor); the static `GridOverlay` in `uikit/src/spread.tsx` is kit-demo only — prefer canvas; `effectiveGrid` / `resolveGrid` (`uikit/src/sandbox/model.ts`); TopBar view toggle `grid` (`uikit/src/sandbox/chrome.tsx`). Snap helpers (`anchors` / `snapRect`) belong with `layout-grids-snap-wire`.
- **Demo:** `layout-grids-render-snap` → `uikit/src/features/m4.tsx`
- **Musts:**
  - `view.grid` on && !Preview: per-page dashed content box (1.5px) + column bands + row bands from `effectiveGrid`; facing pages mirror inside / outside.
  - Overlay `pointer-events: none`; never in Preview / PDF / site.
  - TopBar "Layout grid" / Ctrl+': quiet gray pressed.
- **Hard nos:** no teal / cyan (`#2f9e9a`); no guides / rulers / Frame create; no multi-select; no black on overlay strokes; no floating FrameToolbar; no snap-to-grid wiring in this item (see `layout-grids-snap-wire`).
- **Tokens:** `--grid-line: rgb(83 81 82 / .6)`; `--grid` fill `rgb(83 81 82 / .10)`.
- **Test:** show grid → cols / rows match inspector C×R; hide → overlay gone.
- **Depends:** layout-grids-settings
