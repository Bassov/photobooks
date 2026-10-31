## Proposal

Roadmap: `docs/roadmap/P1/design-r7-panels.md` (scope / Done when). UI ref: kit `#/demo` at 1440 × 900. Owner Must, round 7, relayed by Designer 2026-11-01 (M47, M48, M50, M53, M54).

### Scope out

- Template geometry: One per page keeps the layout-grid margins (kit uses fixed 10 % insets).
- Spreads panel, pasteboard gaps and canvas chrome (sibling items `design-r7-spreads`, `design-r7-canvas-chrome`).
- `uikit/`, Print / Publish.

### Delta / Risk

- Owner design changes: the inspector loses its own hide button (M54); "Suggested for N photos" keeps the current layout, pressed (M47). Specs asserting the old rules are updated and listed in the PR.
- Observables (e2e `design-r7-panels.spec.ts`): page-1 suggestions + apply; Endpaper head boxes; filmstrip wheel → scrollLeft with zoom and window scroll unchanged; Preview opens on Cover; no inspector hide button, top-bar toggle hides / shows.
