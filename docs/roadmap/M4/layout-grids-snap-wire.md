# layout-grids-snap-wire

Tag: feature
Milestone: M4
Title: wire grid snap into frame move/resize

## Scope

- [x] When the grid is visible and snap is on, frame move / resize edges snap to column and row edges; show `snap · column N` / `snap · row N` as a `bg-field` pill
- [x] ~16 CSS px pull while the grid is visible; hidden grid, Alt held, or snap off → no grid snap
- Call `buildGridAnchors` at gesture start and `snapEdgesToGrid` on each `pointermove` of the `frame-selection-handles` move / resize; publish `setSnapHint`.
- **Perf:** anchors built once per gesture. Gate: drag a frame across a 12-column spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** hide grid → drag does not snap to columns; Alt-drag → no `snap · column N` label; snap off → no snap lines.
- **UI ref:** `uikit#/feature/layout-grids-render-snap`
- **Kit components:** `effectiveGrid` / `resolveGrid` / `anchors` / `snapRect` (`uikit/src/sandbox/model.ts`); snap label chrome from the render-snap demo.
- **Demo:** `layout-grids-render-snap` → `uikit/src/features/m4.tsx` (snap labels)
- **Musts:**
  - Grid visible + snap on → move / resize edges to column / row; label `snap · column N` / `snap · row N` (`bg-field` pill, not toast).
  - ~16 CSS px pull when grid visible; hidden grid / Alt / snap-off → no grid snap.
- **Hard nos:** no teal / cyan; no toast for snap hints; no inventing move / resize without `frame-selection-handles`.
- **Test:** grid on + snap on → drag snaps to column with label; hide grid / Alt / snap off → no grid snap.
- **Depends:** frame-selection-handles, snapping-engine, layout-grids-render-snap (after frame-selection-handles + snapping-engine). Pure helpers may already exist from render-snap; this item wires them into the gesture.
