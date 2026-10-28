# free-frames

Tag: feature
Milestone: M4
Title: free layout
Status: done

## Scope

- [ ] Draw + delete frames; keep Phase A selection; live snap lines to guides, other frames and equal gaps; detach spread from template
- Soft / optional Depends on `layout-grids-snap-wire` for snap-to-grid — do **not** block free-frames on snap
- **Perf:** snapping via the anchor index. Gate: drag a frame across a dense spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** draw a frame, snap it to a guide (and to a grid column when snap-wire is in), resize with handles — snap lines appear without lag.
- **UI ref:** `uikit#/feature/free-frames`
- **UI kit:** `uikit/src/features/m4.tsx:59-62` (`free-frames` demo + notes), `UI ref: uikit#/feature/free-frames` — Frame tool draw + snap lines
- **Kit components:** `ToolGroup` / `TopBar` tools `select | frame | hand` (`uikit/src/sandbox/chrome.tsx`); frame draw + drop in `uikit/src/sandbox/canvas.tsx` (`view.tool === "frame"`); canvas selection handles (Phase A look-parity — reuse, do not re-skin); filmstrip drop onto an empty frame (`Filmstrip` in `chrome.tsx` + canvas drop). Cursor class `cursor-tool-frame` (`uikit/src/sandbox/v7.tsx`).
- **Demo:** `free-frames` → `uikit/src/features/m4.tsx`
- **Musts:**
  - Frame tool (F) in the tool rail; V = select; outlined white pointer + thin black outline cursor (product rule).
  - Drag on an empty spread draws an image frame; commit only if both edges ≥ 5 mm; then select it and return to the Select tool.
  - Delete / Backspace removes the selected frame(s); an edited spread clears its template binding (`template: null`).
  - Empty frame: dashed placeholder + filmstrip / photo drop fills it (Phase A filmstrip contract).
  - Selected frame: Phase A canvas-sel only (`#232223` outline + white handles). Live snap to guides / other frames; snap to grid is soft / optional via `layout-grids-snap-wire` (do not block this item on snap); Alt suppresses snap.
- **Hard nos:** no floating `frame-toolbar`; no Text tool in this slice; no multi-select / marquee / arrange; no rotate handle required this PR (can follow); no toast on create — quiet status ok; no blue.
- **Tokens:** canvas sel `#232223`; placeholder dashed quiet gray; tool cursor white + black outline.
- **Test:** F → drag ≥ 5 mm → frame appears selected; Delete removes; drop photo from filmstrip into empty frame; drag under 5 mm → no frame.
- **Depends:** frame-geometry-schema, frame-transform-ops, Phase A canvas-sel + filmstrip, tool-rail; soft / optional `layout-grids-snap-wire` (snap-to-grid — do not block free-frames on snap)
