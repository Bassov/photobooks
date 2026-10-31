## Proposal

Roadmap: `docs/roadmap/P1/design-r3-canvas-fit.md`. UI ref: `uikit#/demo` steps 14–16.

### Scope out

- Click on another frame while a filled frame is selected still swaps.
- Single-page placement and the kit's relative-zoom model.

### Delta / Risk

- Intentional: Fit is one zoom per book (kit), not a refit per spread; page 1 gets smaller on wide trims.
- Observables: empty book at Fit; each spread fitted with "Fit"; drop, click same frame, still selected. No page-level H/V scroll; scrolling only inside the pasteboard.
