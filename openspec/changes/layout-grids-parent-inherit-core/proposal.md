## Proposal

Roadmap: `docs/roadmap/P2/layout-grids-parent-inherit-core.md` (scope / Done when / Browser / Perf SoT); Designer Spec layout-grids-parent-inherit GP7, GP8.

### Scope out

- Any UI: per-field sources, ↺ buttons, hint (G2 `layout-grids-parent-inherit`).
- Re-align on `removeParent` / default-master change (not in GP7).

### Delta / Risk

- A master grid edit now regenerates frames on up to every spread (40 on the painter fixture); the 40-spread frame-budget gate also edits the gutter so the re-align runs inside it.
