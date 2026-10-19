# free-frames

Tag: feature
Milestone: M4
Title: free layout

## Scope

- [ ] Add / delete frames, live snap lines to guides, other frames and equal gaps (grid snapping from `layout-grids-render-snap`), detach spread from template
- **Perf:** snapping via the anchor index. Gate: drag a frame across a dense spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** draw a frame, snap it to a grid column and a guide, resize with handles — snap lines appear without lag.
- **UI ref:** `uikit#/feature/free-frames`
- **UI kit:** `uikit/src/features/m4.tsx:59-62` (`free-frames` demo + notes), `UI ref: uikit#/feature/free-frames` — Frame tool draw + snap lines
