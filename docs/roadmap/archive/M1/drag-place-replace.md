# drag-place-replace

Tag: feature
Milestone: M1
Title: drop photos onto frames

## Scope

- [x] Filmstrip → empty frame (place), → filled frame (replace)
- [x] "Placed" badge on filmstrip thumbnails; photo stays in the filmstrip after placing
- [x] Keyboard-accessible alternative for place and replace
- **Perf:** native drag image; drop targets resolved from cached mm rects (no DOM queries in `dragover`); hover highlight toggles one attribute; one op per drop. Gate: drag across a zoomed-out book — zero LoAF, `dragover` p95 ≤ 2 ms.
- **Browser check:** lay out a few spreads by hand; placed badges update; dragging stays smooth.
- **UI ref:** `uikit#/feature/drag-place-replace`
