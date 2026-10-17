# multi-drop-fill

Tag: feature
Milestone: M3
Title: faster layout

## Scope

- [ ] Multi-select in the filmstrip; drop several photos on a spread fills its empty frames in gallery order
- [ ] Drop between spreads creates a new spread with the best-fit template (`template-slot-aspects`)
- **Perf:** one op per drop; drop targets from cached mm rects. Gate: drop 4 photos on a zoomed-out book — zero LoAF, `dragover` p95 ≤ 2 ms.
- **Browser check:** select four photos, drop them on a 4-grid spread, all frames fill in order; drop two portraits between spreads — a new 2-portrait spread appears.
- **UI ref:** `uikit#/feature/multi-drop-fill`
