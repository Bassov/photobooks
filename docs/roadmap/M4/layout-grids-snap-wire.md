# layout-grids-snap-wire

Tag: feature
Milestone: M4
Title: wire grid snap into frame move/resize

## Scope

- [ ] Call `buildGridAnchors` at gesture start and `snapEdgesToGrid` on each `pointermove` of the `frame-selection-handles` move / resize; publish `setSnapHint`; Alt held → no snap, hidden grid / Shift+S off → no snap.
- Depends on `frame-selection-handles`; the pure module, label, view state and keys already shipped in `layout-grids-render-snap`.
- **Perf:** anchors built once per gesture. Gate: drag a frame across a 12-column spread with snapping on — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** hide grid → drag does not snap to columns; Alt-drag → no `snap · column N` label; snap off → no snap lines.
- **UI ref:** `uikit#/feature/layout-grids-render-snap`
