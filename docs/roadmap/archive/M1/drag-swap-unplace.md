# drag-swap-unplace

Tag: feature
Milestone: M1
Title: rearrange and take back

## Scope

- [x] Frame ↔ frame (swap / move), frame → filmstrip (unplace)
- [x] Keyboard-accessible alternative for swap, move and unplace
- **Perf:** reuses the cached drop targets; one op per drop. Gate: drag a frame across a zoomed-out book — zero LoAF, `dragover` p95 ≤ 2 ms.
- **Browser check:** drag photos back to the filmstrip, swap two frames; placed badges update; dragging stays smooth.
- **UI ref:** `uikit#/feature/drag-swap-unplace`
