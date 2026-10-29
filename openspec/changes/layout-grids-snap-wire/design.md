## Decisions

1. Extend `SnapIndex` with a `grid` anchor set (kind `grid`, label `column N` / `row N`) built from `buildGridAnchors` in `spreadContext`, once per gesture and only while grid visible + snap on. No parallel engine; `snapEdgesToGrid` stays an unused pure helper.
2. Priority: `snapProbes` queries frame / page / guide anchors at 8 px first; grid (16 px, edges only — never centers) only fills an axis they missed. Opt-in via `SnapOptions.grid`, set from `gridSnapActive` (grid visible, not Alt, snap on) by move and handle-resize only; draw stays grid-free.
3. `SnapResult.hint` (`snap · column N`, x axis first) goes to `setSnapHint` per pointermove and is cleared in gesture `finish`. Grid snap lines carry no inline label (the `bg-field` pill from `SnapLabel` does).
4. The pill is scoped to the dragged spread (`setSnapHint(hint, spreadId)`; `SnapLabel` filters by spread) so other spreads' overlays do not repeat it.
5. Security: N/A.

## Touch-set & Test Plan

- Files: `src/editor/snapIndex.ts`, `frameGesture.ts`, `frameHandleGesture.ts`, `snapHint.ts`, `SnapLabel.tsx`, `GridOverlay.tsx` (+ tests), `e2e/layout-grids-snap-wire.spec.ts`, editor-shell delta spec, roadmap item.
- Reuse: `buildGridAnchors`, `GRID_SNAP_PULL_PX`, `SnapLabel`, `snapHint`.
- Tests: `snapIndex` unit (move/row/resize/priority/zoom/Alt), gesture unit (grid on, hidden, Alt, snap off, cancel), e2e grid-on drag label + bypasses (scoped by test id), 12-column perf scenario in the same spec (`frame-gesture` handler p95 + zero LoAF).
