## Proposal

Roadmap: `docs/roadmap/P1/design-r2-spread-list.md`. UI ref: uikit#/demo.

### Scope out

- `uikit/`, `#/demo`, kit `SpreadActions`.
- Camera world pad (`design-canvas-camera`); kit "last page" list item (M10).

### Delta / Risk

- The canvas gap is a constant 44 px at any zoom.
- Observables: Cover / Endpaper rows move with `spreads-list` scrollTop; no Add spread button, Add after adds; 44 px gap. No page-level H/V scroll; scrolling only inside `spreads-list` and `pasteboard-scroll`.
