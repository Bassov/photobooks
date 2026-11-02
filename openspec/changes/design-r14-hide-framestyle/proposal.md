## Proposal

Roadmap: `docs/roadmap/P1/design-r14-hide-framestyle.md` (scope / Done when / Browser SoT). UI ref: `uikit#/demo` step `editor-frame-selected`. Owner Q8 (2026-11-02 08:36): hide FRAME STYLE / ARRANGE until their roadmap item.

### Scope out

- Frame-style / z-order model, ops, history and their unit tests stay.
- Text / multi-select contexts, `uikit/`, `App.tsx`.

### Delta / Risk

- Existing e2e on these sections flip to hidden only; empty frame shows the same list; every-section-open scrolls only inside `inspector-body` (no page-level scroll).
