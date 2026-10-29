## Proposal

Roadmap: `docs/roadmap/M4/layout-grids-snap-wire.md` (scope / Musts / Browser / Perf SoT). UI ref: `uikit#/feature/layout-grids-render-snap`.

### Scope out

- No rulers / guides snap, multi-select, or Preview / PDF grid.
- Draw-corner snap keeps frame / page / guide anchors only.

### Delta / Risk

- Grid anchors join the #269 snap index (queried after frame / page / guide misses); move and handle-resize publish `setSnapHint`.
- UI observables e2e locks in: grid on + drag → `snap-label` `snap · column N` and one `snap-line`; hidden grid / Alt / snap off → neither. No scroll change.
- Security: N/A.
