## Proposal

Roadmap: `docs/roadmap/P2/parent-spreads-inspector.md`; Designer Spec I1 (MS1–MS9), UI ref `uikit#/feature/parent-spreads`.

### Scope out

- Master guides / rulers (MS10) → `parent-spreads-inspector-guides` (Owner brief 2026-11-03).
- Page numbers / Background in prod; spread Custom grid restyle (Spec I3).
- Template re-align and "Reset to parent" → `layout-grids-parent-inherit`.

### Delta / Risk

- A master grid edit re-renders only the master and the spreads using it (40-spread gate); no page-level H/V scroll or layout shift (e2e).
- Kit v7.tsx edits ship here (kit rule: same PR as prod).
